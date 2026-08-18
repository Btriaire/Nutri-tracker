export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MICRONUTRIENT_CODES = [
  "magnesium", "zinc", "vitamin_d", "chromium", "selenium", "iron", "calcium",
  "potassium", "iodine", "copper", "manganese", "molybdenum", "vitamin_b12",
  "folate", "vitamin_c", "vitamin_e", "vitamin_k", "biotin", "pantothenic",
  "niacin", "riboflavin", "thiamine",
] as const;

const SYSTEM_PROMPT = `Tu es un expert en nutrition et compléments alimentaires francophone. Pour le produit donné, retourne UNIQUEMENT un objet JSON valide (sans markdown) avec ces champs :
- description: string       (courte description du produit et ses bénéfices, max 150 caractères)
- ingredients: string[]     (liste des composants/ingrédients principaux)
- dosagePerServing: string  (dosage par prise, ex: "1000 IU", "500 mg")
- recommendedDosage: string (posologie recommandée, ex: "1 comprimé par jour au repas")
- micronutrients: array     (profil micronutrimentaire RÉEL par prise, à partir de tes connaissances nutritionnelles du produit)
  Chaque élément : { "code": string, "amount": number, "unit": string }
  "code" DOIT être une valeur EXACTE parmi cette liste : ${MICRONUTRIENT_CODES.join(", ")}
  N'invente pas de code hors de cette liste. N'inclus QUE les micronutriments réellement présents et significatifs dans ce produit (souvent 1 à 3 pour un produit mono-nutriment comme "Vitamine D3", potentiellement plus pour un multivitamine).
  Si le produit ne contient aucun micronutriment de la liste (ex: probiotique, oméga-3 pur), retourne un tableau vide [].
  "unit" DOIT être en mg ou µg UNIQUEMENT — jamais "IU"/"UI". Les apports issus de la
  nourriture pour ce même nutriment sont toujours en mg/µg dans cette appli ; renvoyer une
  valeur en IU la ferait s'additionner à tort avec ces apports comme si c'était la même unité.
  Si tu ne connais le dosage qu'en IU (fréquent pour la vitamine D), convertis-le toi-même :
  vitamine D — µg = IU ÷ 40 ; vitamine E — mg ≈ IU × 0.67.

Réponds uniquement en JSON. Ne fournis aucune explication hors du JSON.`;

interface SupplementMicronutrientAI {
  code:   string;
  amount: number;
  unit:   string;
}

interface SupplementInfo {
  description:       string;
  ingredients:        string[];
  dosagePerServing:   string;
  recommendedDosage:  string;
  micronutrients?:    SupplementMicronutrientAI[];
}

/**
 * Safety net in case the model returns IU despite the prompt instruction (temperature
 * isn't 0, so this does happen occasionally) — food-derived intakes for the same
 * micronutrient are always logged in mg/µg, and summing an IU amount straight into that
 * total silently produces a wildly wrong daily figure (e.g. a 2000 IU vitamin D3 capsule
 * read as "2000µg" instead of the correct 50µg).
 */
function normalizeUnit(m: SupplementMicronutrientAI): SupplementMicronutrientAI {
  const unit = m.unit?.trim().toUpperCase();
  if (unit !== "IU" && unit !== "UI") return m;
  if (m.code === "vitamin_d") return { ...m, amount: Math.round((m.amount / 40) * 100) / 100, unit: "µg" };
  if (m.code === "vitamin_e") return { ...m, amount: Math.round(m.amount * 0.67 * 100) / 100, unit: "mg" };
  return m; // unexpected IU on another nutrient — leave as-is rather than guess a factor
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  let body: { productName: string };
  try {
    body = await req.json() as { productName: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productName = body.productName?.trim();
  if (!productName) return NextResponse.json({ error: "productName required" }, { status: 400 });

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // llama-3.3-70b-versatile was deprecated by Groq
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Complément alimentaire : ${productName}` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq supplement-ai error:", err);
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as SupplementInfo;

    // Filter out any hallucinated micronutrient codes not in our known list
    const validCodes = new Set<string>(MICRONUTRIENT_CODES);
    const micronutrients = (parsed.micronutrients || [])
      .filter(m => m.code && validCodes.has(m.code) && typeof m.amount === "number" && m.amount > 0)
      .map(normalizeUnit);

    return NextResponse.json({ ok: true, ...parsed, micronutrients });
  } catch (e) {
    console.error("Supplement AI lookup error:", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
