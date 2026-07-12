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
  "unit" doit être cohérent (mg, µg ou IU selon le nutriment).

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
        model: "llama-3.3-70b-versatile",
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
    const micronutrients = (parsed.micronutrients || []).filter(
      m => m.code && validCodes.has(m.code) && typeof m.amount === "number" && m.amount > 0
    );

    return NextResponse.json({ ok: true, ...parsed, micronutrients });
  } catch (e) {
    console.error("Supplement AI lookup error:", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
