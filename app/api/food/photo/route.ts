import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import type { FoodSearchResult, FoodNutrition } from "@/app/lib/types";

export const dynamic = "force-dynamic";

interface ClaudeFood {
  name: string;
  estimatedGrams: number;
  per100g: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
  };
}

function scaleToGrams(per100g: ClaudeFood["per100g"], grams: number): FoodNutrition {
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ results: [] });

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "No image" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Tu es un expert en nutrition. Analyse cette photo de repas et identifie chaque aliment visible.
Pour chaque aliment, retourne un objet JSON. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après.

Format requis :
[
  {
    "name": "nom de l'aliment en français",
    "estimatedGrams": 150,
    "per100g": {
      "calories": 250,
      "proteinG": 20,
      "carbsG": 15,
      "fatG": 10,
      "fiberG": 2
    }
  }
]

Estime les quantités d'après la photo. Si tu ne vois pas clairement un aliment, ne l'inclus pas.`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return NextResponse.json({ results: [] });

    const json = await res.json() as { content: { type: string; text: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "[]";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ results: [] });

    const foods = JSON.parse(jsonMatch[0]) as ClaudeFood[];

    const results: FoodSearchResult[] = foods.map((f, i) => ({
      id:           `photo:${i}:${f.name.toLowerCase().replace(/\s+/g, "-")}`,
      source:       "custom",
      name:         f.name,
      servingSizeG: f.estimatedGrams,
      servingLabel: `${f.estimatedGrams}g (photo)`,
      nutrition:    scaleToGrams(f.per100g, f.estimatedGrams),
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
