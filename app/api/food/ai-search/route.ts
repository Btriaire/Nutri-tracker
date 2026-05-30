export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import type { FoodSearchResult } from "@/app/lib/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un nutritionniste expert. Quand on te donne un aliment, retourne un objet JSON avec un champ "results" contenant 1 à 3 variantes (ex: cru/cuit, différentes préparations).

Chaque variante a ces champs OBLIGATOIRES (valeurs pour 100g) :
- name: string (nom en français, précis)
- calories_100g: number (kcal)
- protein_100g: number (g)
- carbs_100g: number (g)
- fat_100g: number (g)
- fiber_100g: number (g, 0 si inconnu)
- serving_g: number (portion habituelle en g, ex: 150 pour un steak, 30 pour du pain)
- serving_label: string (ex: "1 steak (150g)", "1 tranche (30g)", "100g")

Retourne UNIQUEMENT du JSON valide, sans markdown ni explication.`;

interface GroqResult {
  name:          string;
  calories_100g: number;
  protein_100g:  number;
  carbs_100g:    number;
  fat_100g:      number;
  fiber_100g:    number;
  serving_g:     number;
  serving_label: string;
}

function toFoodResult(r: GroqResult, index: number): FoodSearchResult {
  const s     = Math.max(1, r.serving_g ?? 100);
  const scale = s / 100;
  const label = r.serving_label ?? `${s}g`;
  return {
    id:           `ai:${r.name.toLowerCase().replace(/[\s']/g, "-")}-${index}`,
    source:       "ai",
    name:         r.name,
    servingSizeG: s,
    servingLabel: label,
    // Include the AI's native serving as the default option + 100g fallback
    servingOptions: [
      { label, grams: s, isDefault: true },
      ...(s !== 100 ? [{ label: "100 g", grams: 100 }] : []),
    ],
    nutrition: {
      calories: Math.round((r.calories_100g ?? 0) * scale),
      proteinG: Math.round((r.protein_100g  ?? 0) * scale * 10) / 10,
      carbsG:   Math.round((r.carbs_100g    ?? 0) * scale * 10) / 10,
      fatG:     Math.round((r.fat_100g      ?? 0) * scale * 10) / 10,
      fiberG:   Math.round((r.fiber_100g    ?? 0) * scale * 10) / 10,
    },
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  try {
    const res = await fetch(GROQ_URL, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:           "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature:     0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Aliment : ${q}` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq error:", err);
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed  = JSON.parse(content) as { results?: GroqResult[] };
    const raw     = Array.isArray(parsed.results) ? parsed.results : [];

    const results: FoodSearchResult[] = raw
      .filter((r): r is GroqResult => !!r?.name && typeof r.calories_100g === "number")
      .slice(0, 3)
      .map(toFoodResult);

    return NextResponse.json({ results });
  } catch (e) {
    console.error("AI food search error:", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
