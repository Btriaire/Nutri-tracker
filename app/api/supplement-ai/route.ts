export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un expert en nutrition et compléments alimentaires francophone. Pour le produit donné, retourne UNIQUEMENT un objet JSON valide (sans markdown) avec ces champs :
- description: string       (courte description du produit et ses bénéfices, max 150 caractères)
- ingredients: string[]     (liste des composants/ingrédients principaux)
- dosagePerServing: string  (dosage par prise, ex: "1000 IU", "500 mg")
- recommendedDosage: string (posologie recommandée, ex: "1 comprimé par jour au repas")

Réponds uniquement en JSON. Ne fournis aucune explication hors du JSON.`;

interface SupplementInfo {
  description:       string;
  ingredients:        string[];
  dosagePerServing:   string;
  recommendedDosage:  string;
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

    return NextResponse.json({ ok: true, ...parsed });
  } catch (e) {
    console.error("Supplement AI lookup error:", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
