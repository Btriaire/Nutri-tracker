export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MICRONUTRIENT_CODES = Object.keys(MICRONUTRIENT_DB);

const SYSTEM_PROMPT = `Tu es un expert en nutrition francophone. Pour l'aliment et la quantité donnés, retourne UNIQUEMENT un objet JSON valide (sans markdown) avec ce champ :
- micronutrients: array   (profil micronutrimentaire RÉEL de cet aliment pour la quantité donnée, à partir de tes connaissances nutritionnelles)
  Chaque élément : { "code": string, "amount": number, "unit": string }
  "code" DOIT être une valeur EXACTE parmi cette liste : ${MICRONUTRIENT_CODES.join(", ")}
  N'invente pas de code hors de cette liste. Inclus tous les micronutriments de la liste réellement présents en quantité significative dans cet aliment pour la quantité donnée (par exemple une orange contient de la vitamine C, du potassium, du folate ; un poivron contient beaucoup de vitamine C ; un poisson gras contient de la vitamine D).
  "amount" doit être calculé pour la quantité EXACTE donnée (pas pour 100g si la quantité diffère).
  "unit" doit être cohérent avec le nutriment (mg ou µg).
  Si l'aliment n'a vraiment aucun micronutriment notable de la liste, retourne un tableau vide [].

Réponds uniquement en JSON. Ne fournis aucune explication hors du JSON.`;

interface FoodMicronutrientAI {
  code:   string;
  amount: number;
  unit:   string;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  let body: { name: string; grams: number };
  try {
    body = await req.json() as { name: string; grams: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name  = body.name?.trim();
  const grams = body.grams;
  if (!name || !grams) return NextResponse.json({ error: "name and grams required" }, { status: 400 });

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
          { role: "user",   content: `Aliment : ${name}, quantité : ${grams}g` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq food-micronutrient-ai error:", err);
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { micronutrients?: FoodMicronutrientAI[] };

    // Filter out any hallucinated micronutrient codes not in our known list
    const validCodes = new Set<string>(MICRONUTRIENT_CODES);
    const micronutrients = (parsed.micronutrients || []).filter(
      m => m.code && validCodes.has(m.code) && typeof m.amount === "number" && m.amount > 0
    );

    return NextResponse.json({ ok: true, micronutrients });
  } catch (e) {
    console.error("Food micronutrient AI lookup error:", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
