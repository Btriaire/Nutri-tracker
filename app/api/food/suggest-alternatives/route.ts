export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import type { FoodNutrition } from "@/app/lib/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un nutritionniste expert. On te donne un aliment de référence (valeurs pour 100g).
Propose 12 aliments DIFFÉRENTS (pas des variantes du même aliment) qui peuvent le remplacer dans un repas,
avec un profil nutritionnel globalement comparable (répartition protéines/glucides/lipides proche).
Varie les familles d'aliments (féculents, protéines animales/végétales, légumineuses, laitages, etc.)
pour donner un choix large plutôt que des aliments très proches les uns des autres.

Parmi les options plausibles, favorise celles qui sont plus saines que la référence :
moins de glucides et moins de lipides pour un nombre de calories équivalent, à profil sinon comparable.
Ne propose jamais un aliment beaucoup plus calorique/gras/sucré que la référence.

Retourne un objet JSON avec un champ "suggestions" : 12 objets avec ces champs OBLIGATOIRES (valeurs pour 100g) :
- name: string (nom en français, précis)
- calories_100g: number
- protein_100g: number (g)
- carbs_100g: number (g)
- sugar_100g: number (g)
- fat_100g: number (g)
- saturated_fat_100g: number (g)
- fiber_100g: number (g, 0 si inconnu)

Retourne UNIQUEMENT du JSON valide, sans markdown ni explication.`;

interface GroqSuggestion {
  name:               string;
  calories_100g:      number;
  protein_100g:       number;
  carbs_100g:         number;
  sugar_100g?:        number;
  fat_100g:           number;
  saturated_fat_100g?: number;
  fiber_100g:         number;
}

export interface SuggestedFood {
  name:    string;
  per100g: FoodNutrition;
}

function toSuggestion(r: GroqSuggestion): SuggestedFood {
  return {
    name: r.name,
    per100g: {
      calories:      Math.round(r.calories_100g ?? 0),
      proteinG:      Math.round((r.protein_100g ?? 0) * 10) / 10,
      carbsG:        Math.round((r.carbs_100g   ?? 0) * 10) / 10,
      fatG:          Math.round((r.fat_100g     ?? 0) * 10) / 10,
      fiberG:        Math.round((r.fiber_100g   ?? 0) * 10) / 10,
      sugarG:        r.sugar_100g          != null ? Math.round(r.sugar_100g * 10) / 10 : undefined,
      saturatedFatG: r.saturated_fat_100g  != null ? Math.round(r.saturated_fat_100g * 10) / 10 : undefined,
    },
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; per100g?: FoodNutrition };
  try {
    body = await req.json() as { name?: string; per100g?: FoodNutrition };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name || !body.per100g) return NextResponse.json({ error: "Missing name or per100g" }, { status: 400 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  const { name, per100g } = body;

  try {
    const res = await fetch(GROQ_URL, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:           "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature:     0.4,
        max_tokens:      2000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content:
            `Aliment de référence : ${name}\n` +
            `Pour 100g : ${Math.round(per100g.calories)} kcal, ${per100g.proteinG}g protéines, ` +
            `${per100g.carbsG}g glucides, ${per100g.fatG}g lipides.` },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Groq suggest-alternatives error:", await res.text());
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed  = JSON.parse(content) as { suggestions?: GroqSuggestion[] };
    const raw     = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    const suggestions = raw
      .filter((r): r is GroqSuggestion => !!r?.name && typeof r.calories_100g === "number")
      .slice(0, 12)
      .map(toSuggestion);

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("Suggest alternatives error:", e);
    return NextResponse.json({ error: "Suggestion failed" }, { status: 500 });
  }
}
