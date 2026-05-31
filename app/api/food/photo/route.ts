import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import type { FoodSearchResult, FoodNutrition } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

interface DetectedFood {
  name:          string;
  estimatedGrams: number;
  per100g: {
    calories: number;
    proteinG: number;
    carbsG:   number;
    fatG:     number;
    fiberG:   number;
  };
}

function scaleToGrams(per100g: DetectedFood["per100g"], grams: number): FoodNutrition {
  const r = grams / 100;
  return {
    calories: Math.round(per100g.calories * r),
    proteinG: Math.round(per100g.proteinG * r * 10) / 10,
    carbsG:   Math.round(per100g.carbsG   * r * 10) / 10,
    fatG:     Math.round(per100g.fatG     * r * 10) / 10,
    fiberG:   Math.round(per100g.fiberG   * r * 10) / 10,
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY non configurée", results: [] }, { status: 503 });

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "No image" }, { status: 400 });

  const buffer  = await file.arrayBuffer();
  const base64  = Buffer.from(buffer).toString("base64");
  const mime    = file.type || "image/jpeg";

  const prompt = `Tu es un expert en nutrition. Analyse cette photo et identifie chaque aliment visible.
Réponds UNIQUEMENT avec un JSON valide, sans markdown ni texte autour.

Format :
{"foods":[{"name":"nom en français","estimatedGrams":150,"per100g":{"calories":200,"proteinG":15,"carbsG":10,"fatG":8,"fiberG":2}}]}

Estime les grammes d'après la photo. Si tu ne vois pas clairement, ne l'inclus pas.`;

  try {
    const res = await fetch(GROQ_URL, {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:           "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature:     0.2,
        max_tokens:      1024,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            { type: "text", text: prompt },
          ],
        }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq vision error:", err);
      return NextResponse.json({ error: "Vision API error", results: [] }, { status: 502 });
    }

    const data  = await res.json() as { choices: { message: { content: string } }[] };
    const raw   = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { foods?: DetectedFood[] };
    const foods  = parsed.foods ?? [];

    const results: FoodSearchResult[] = foods
      .filter((f) => f?.name && f.estimatedGrams > 0)
      .map((f, i) => ({
        id:           `photo:${i}:${f.name.toLowerCase().replace(/\s+/g, "-")}`,
        source:       "ai" as const,
        name:         f.name,
        servingSizeG: f.estimatedGrams,
        servingLabel: `${f.estimatedGrams}g (photo)`,
        servingOptions: [
          { label: `${f.estimatedGrams}g (photo)`, grams: f.estimatedGrams, isDefault: true },
          { label: "100 g", grams: 100 },
        ],
        nutrition: scaleToGrams(f.per100g, f.estimatedGrams),
      }));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Photo recognition error:", e);
    return NextResponse.json({ error: "Reconnaissance échouée", results: [] }, { status: 500 });
  }
}
