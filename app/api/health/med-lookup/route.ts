export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un pharmacien expert francophone. Pour le médicament donné, retourne UNIQUEMENT un objet JSON valide (sans markdown) avec ces champs :
- dose: string          (dosage standard adulte, ex: "500 mg - 1 g toutes les 6-8h, max 4 g/j")
- indication: string    (indication principale courte, max 80 caractères)
- description: string   (description courte du médicament, max 120 caractères)
- warning: string|null  (mise en garde principale si applicable, null sinon, max 80 caractères)
- class: string         (classe thérapeutique, ex: "Analgésique / Antipyrétique")

Réponds uniquement en JSON. Ne fournis aucune explication hors du JSON.`;

interface MedInfo {
  dose:        string;
  indication:  string;
  description: string;
  warning:     string | null;
  class:       string;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  let body: { name: string };
  try {
    body = await req.json() as { name: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

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
          { role: "user",   content: `Médicament : ${name}` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq med-lookup error:", err);
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as MedInfo;

    return NextResponse.json({ ok: true, ...parsed });
  } catch (e) {
    console.error("Med lookup error:", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
