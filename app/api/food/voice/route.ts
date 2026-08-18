import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import type { FoodSearchResult, FoodNutrition, MealType } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

interface DetectedFood {
  name:           string;
  estimatedGrams: number;
  meal?:          string;
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

const SYSTEM_PROMPT = `Tu es un nutritionniste expert francophone. L'utilisateur DÉCRIT À VOIX HAUTE ce qu'il a mangé, en langage naturel (ex: "ce midi j'ai mangé environ 150g de poulet rôti, du riz et une pomme").

Ta mission : extraire CHAQUE aliment distinct, estimer sa quantité en grammes, et fournir ses valeurs nutritionnelles pour 100g.

Réponds UNIQUEMENT avec un JSON valide, sans markdown ni texte autour.

Format :
{"foods":[{"name":"nom en français","estimatedGrams":150,"meal":"lunch","per100g":{"calories":200,"proteinG":15,"carbsG":10,"fatG":8,"fiberG":2}}]}

Règles :
- "meal" doit valoir exactement "breakfast", "lunch", "dinner" ou "snacks".
- Déduis le repas du contexte ("ce matin"/"petit-déj" → breakfast, "ce midi"/"déjeuner" → lunch, "ce soir"/"dîner" → dinner, "goûter"/"en-cas"/"collation" → snacks).
- Si le repas n'est pas précisé, utilise le repas par défaut fourni par l'utilisateur.
- Si une quantité n'est pas donnée, estime une portion habituelle réaliste (ex: 1 pomme ≈ 150g, 1 tranche de pain ≈ 30g).
- N'invente pas d'aliments non mentionnés. Ignore les mots de remplissage.`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY non configurée", results: [] }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { text?: string; defaultMeal?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Aucune description", results: [] }, { status: 400 });

  const defaultMeal: MealType = MEALS.includes(body.defaultMeal as MealType)
    ? (body.defaultMeal as MealType)
    : "lunch";

  try {
    const res = await fetch(GROQ_URL, {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:           "openai/gpt-oss-120b", // llama-3.3-70b-versatile was deprecated by Groq
        reasoning_effort: "low",
        temperature:     0.2,
        max_tokens:      1024,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Repas par défaut : ${defaultMeal}\nDescription : ${text}` },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq voice error:", err);
      return NextResponse.json({ error: "IA indisponible", results: [] }, { status: 502 });
    }

    const data   = await res.json() as { choices: { message: { content: string } }[] };
    const raw     = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { foods?: DetectedFood[] };
    const foods  = parsed.foods ?? [];

    const results = foods
      .filter((f) => f?.name && f.estimatedGrams > 0)
      .map((f, i) => {
        const meal: MealType = MEALS.includes(f.meal as MealType) ? (f.meal as MealType) : defaultMeal;
        const result: FoodSearchResult = {
          id:           `voice:${i}:${f.name.toLowerCase().replace(/\s+/g, "-")}`,
          source:       "ai" as const,
          name:         f.name,
          servingSizeG: f.estimatedGrams,
          servingLabel: `${f.estimatedGrams}g (dicté)`,
          servingOptions: [
            { label: `${f.estimatedGrams}g (dicté)`, grams: f.estimatedGrams, isDefault: true },
            { label: "100 g", grams: 100 },
          ],
          nutrition: scaleToGrams(f.per100g, f.estimatedGrams),
        };
        return { result, meal, per100g: f.per100g, grams: f.estimatedGrams };
      });

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Voice recognition error:", e);
    return NextResponse.json({ error: "Reconnaissance échouée", results: [] }, { status: 500 });
  }
}
