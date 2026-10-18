export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getMealHabitProfile, getRecentlySuggested, recordSuggested } from "@/app/lib/meal-habits";
import type { MealType, NutritionGoals } from "@/app/lib/types";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { resolveDietProgramId, dietMealSummary, DIET_INTERDITS_SUMMARY, APPROVED_FRUITS_SUMMARY, FORBIDDEN_FRUITS_SUMMARY, CHOLESTEROL_FAVORISER_SUMMARY, CHOLESTEROL_LIMITER_SUMMARY } from "@/app/lib/diet-program";
import type { UserProfile } from "@/app/lib/types";
import { GROQ_TEXT_MODEL } from "@/app/lib/groq";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MEAL_CALORIE_PCT: Record<MealType, number> = {
  breakfast: 0.25,
  morning_snack: 0.05,
  lunch:     0.35,
  dinner:    0.30,
  snacks:    0.10,
};

const MEAL_NAMES_FR: Record<MealType, string> = {
  breakfast: "Petit-déjeuner",
  morning_snack: "Collation du matin",
  lunch:     "Déjeuner",
  dinner:    "Dîner",
  snacks:    "Collation",
};

const CATEGORY_LABEL_FR: Record<string, string> = {
  feculents:    "féculents",
  legumineuses: "légumineuses",
  viande:       "viande",
  poisson:      "poisson",
  oeuf:         "œufs",
  laitage:      "laitages",
  legume:       "légumes",
  fruit:        "fruits",
  oleagineux:   "oléagineux",
  corpsgras:    "corps gras",
  sucrerie:     "sucré",
  boisson:      "boissons",
  autre:        "autre",
};

export interface SuggestionIngredient {
  name:     string;
  quantity: number;
  unit:     string;
  calories: number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
}

export interface MealSuggestion {
  id:          string;
  name:        string;
  emoji:       string;
  description: string;
  prepTimeMin: number;
  difficulty:  "facile" | "moyen";
  ingredients: SuggestionIngredient[];
  totalNutrition: {
    calories: number;
    proteinG: number;
    carbsG:   number;
    fatG:     number;
    fiberG:   number;
  };
  tip?: string;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  let body: { meal: MealType; goals: NutritionGoals; alreadyKcal?: number; excludeFoods?: string[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { meal, goals, alreadyKcal = 0, excludeFoods = [] } = body;
  if (!["breakfast", "morning_snack", "lunch", "dinner", "snacks"].includes(meal)) {
    return NextResponse.json({ error: "Invalid meal" }, { status: 400 });
  }

  const budget         = Math.round(goals.dailyCalories * MEAL_CALORIE_PCT[meal]);
  const remaining      = Math.max(0, goals.dailyCalories - alreadyKcal);
  const adjustedBudget = Math.min(budget, remaining);
  const program        = (goals.plan as { programLabel?: string } | undefined)?.programLabel ?? "équilibré";
  // Programme alimentaire reel du compte (profil), pas celui de la requete
  const profileSnap = await getAdminFirestore().doc(`users/${session.userId}`).get();
  const dietId      = resolveDietProgramId((profileSnap.data() as UserProfile | undefined)?.dietProgram);
  const dietBlock   = dietId === "tl" || dietId === "tl_nk"
    ? `
Regime imposé (ordonnance, à respecter STRICTEMENT dans CHAQUE proposition) :
- Repère de ce repas : ${dietMealSummary(meal, dietId)}
- Interdits : ${DIET_INTERDITS_SUMMARY}
- Fruits autorisés (un seul choix par repas, jamais en jus) : ${APPROVED_FRUITS_SUMMARY}
- Fruits interdits : ${FORBIDDEN_FRUITS_SUMMARY}
- Pain ou pâtes uniquement complets ; jamais de pain blanc ni de pâtes blanches.`
    : dietId === "cholesterol"
      ? `
Regime imposé (à respecter dans CHAQUE proposition) :
- Favoriser : ${CHOLESTEROL_FAVORISER_SUMMARY}
- Limiter : ${CHOLESTEROL_LIMITER_SUMMARY}`
      : "";
  const proteinTarget  = Math.round(goals.proteinGrams * MEAL_CALORIE_PCT[meal]);

  // Learned from the user's own history for THIS meal slot — see meal-habits.ts.
  const [habits, recentlySuggested] = await Promise.all([
    getMealHabitProfile(session.userId, meal),
    getRecentlySuggested(session.userId, meal),
  ]);
  const personalized = Object.keys(habits.categoryPalette).length > 0;

  const paletteLines = Object.entries(habits.categoryPalette)
    .map(([cat, names]) => `- ${CATEGORY_LABEL_FR[cat] ?? cat} : ${names.join(", ")}`)
    .join("\n");

  const systemPrompt = `Tu es un nutritionniste expert inspiré de Jean-Michel Cohen.
Tu proposes des repas simples, pratiques, typiques de la cuisine française du quotidien, avec des valeurs nutritionnelles précises et réalistes.
Réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après.`;

  const userMessage = `Génère 5 propositions de repas pour : ${MEAL_NAMES_FR[meal]}

Profil nutritionnel :
- Programme : ${program}
- Budget calorique ce repas : ~${adjustedBudget} kcal (objectif journalier : ${goals.dailyCalories} kcal)
- Protéines cibles ce repas : ~${proteinTarget}g
- Objectif hebdomadaire : ${goals.weeklyGoal === "lose" ? "perte de poids" : goals.weeklyGoal === "gain" ? "prise de masse" : "maintien"}
${habits.macroSplit ? `- Répartition macro habituelle de l'utilisateur pour ce repas : ${habits.macroSplit.proteinPct}% protéines / ${habits.macroSplit.carbsPct}% glucides / ${habits.macroSplit.fatPct}% lipides — vise une répartition proche, pas juste le même total de calories.` : ""}
${personalized ? `
Palette de goûts de l'utilisateur pour ce repas, appris de son historique, par catégorie :
${paletteLines}
Varie l'aliment PRÉCIS choisi dans chaque catégorie plutôt que de toujours reprendre le même (ex. si "poisson" contient "saumon", tu peux proposer "cabillaud" ou "thon" — même catégorie appréciée, ingrédient différent). Ne sors pas de ces catégories sauf si nécessaire pour l'équilibre du repas.` : ""}
${excludeFoods.length > 0 ? `
Déjà mangé aujourd'hui à ce repas : ${excludeFoods.join(", ")}. Ne propose pas les mêmes aliments — le but est une vraie alternative, mêmes calories mais des ingrédients différents.` : ""}
${recentlySuggested.length > 0 ? `
Repas déjà suggérés récemment pour ce créneau (ne pas répéter à l'identique) : ${recentlySuggested.join(", ")}.` : ""}

${dietBlock}
Propose 5 repas variés, tous conformes au régime imposé ci-dessus s'il existe : au moins 1 léger, 1 équilibré, 1 rassasiant, et 2 autres différents des précédents.
Les recettes doivent être réalisables en moins de 20 min, sans matériel spécial.
Les valeurs nutritionnelles doivent être cohérentes avec les quantités.

Format JSON exact :
{
  "suggestions": [
    {
      "id": "s1",
      "name": "Œufs cocotte aux tomates",
      "emoji": "🥚",
      "description": "Œufs en ramequin avec tomates concassées, cuisson au four 12 min.",
      "prepTimeMin": 12,
      "difficulty": "facile",
      "ingredients": [
        { "name": "Œufs entiers", "quantity": 2, "unit": "unité", "calories": 144, "proteinG": 12, "carbsG": 1, "fatG": 10 },
        { "name": "Tomates concassées", "quantity": 100, "unit": "g", "calories": 20, "proteinG": 1, "carbsG": 4, "fatG": 0 }
      ],
      "totalNutrition": { "calories": 280, "proteinG": 22, "carbsG": 18, "fatG": 8, "fiberG": 3 },
      "tip": "Manger lentement permet de mieux ressentir la satiété — posez la fourchette entre chaque bouchée."
    }
  ]
}`;

  try {
    const res = await fetch(GROQ_URL, {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:           GROQ_TEXT_MODEL, // llama-3.3-70b-versatile was deprecated by Groq
        reasoning_effort: "low",
        temperature:     0.72,
        max_tokens:      4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Groq menu-suggestions error:", await res.text());
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const groqData = await res.json() as { choices: { message: { content: string } }[] };
    const raw = groqData.choices?.[0]?.message?.content?.trim() ?? "{}";

    let parsed: { suggestions?: MealSuggestion[] };
    try {
      parsed = JSON.parse(raw) as { suggestions?: MealSuggestion[] };
    } catch {
      console.error("Failed to parse Groq JSON:", raw.slice(0, 200));
      return NextResponse.json({ error: "Invalid JSON from model" }, { status: 502 });
    }

    const suggestions = parsed.suggestions ?? [];
    if (suggestions.length > 0) {
      // Best-effort, never blocks the response — feeds the anti-repetition memory for next time.
      recordSuggested(session.userId, meal, suggestions.map((s) => s.name)).catch(() => {});
    }

    return NextResponse.json({ suggestions, personalized });
  } catch (e) {
    console.error("Menu suggestions error:", e);
    return NextResponse.json({ error: "Suggestion failed" }, { status: 500 });
  }
}
