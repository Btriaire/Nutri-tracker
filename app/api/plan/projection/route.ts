export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { NutritionPlan, NutritionGoals } from "@/app/lib/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un expert en nutrition et en diététique. On te donne un plan nutritionnel avec des informations sur la personne.
Retourne UNIQUEMENT un objet JSON valide (sans markdown) avec ces champs :
- weeklyLossKg: number (perte ou gain hebdomadaire attendu en kg, négatif = perte, positif = gain)
- projectedTargetDate: string (date ISO "YYYY-MM-DD" estimée pour atteindre le poids cible)
- note: string (une phrase de conseil courte en français, max 120 caractères)

Base-toi sur un déficit/surplus calorique par rapport au TDEE estimé, et sur 7700 kcal ≈ 1 kg de graisse.`;

interface GroqProjection {
  weeklyLossKg:        number;
  projectedTargetDate: string;
  note:                string;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  let body: { plan: NutritionPlan; goals: NutritionGoals };
  try {
    body = await req.json() as { plan: NutritionPlan; goals: NutritionGoals };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { plan, goals } = body;

  if (plan.targetWeightKg === null || plan.startWeightKg === null) {
    return NextResponse.json(
      { error: "targetWeightKg and startWeightKg are required" },
      { status: 400 }
    );
  }

  const userMessage = `
Programme : ${plan.programLabel} (${plan.programKey})
Date de départ : ${plan.startDate}
Poids de départ : ${plan.startWeightKg} kg
Poids cible : ${plan.targetWeightKg} kg
Calories quotidiennes : ${plan.dailyCalories} kcal
Objectif : ${goals.weeklyGoal}
Niveau d'activité : ${goals.activityLevel}
Âge : ${goals.age ?? "non renseigné"}
Taille : ${goals.heightCm ?? "non renseigné"} cm
Genre : ${goals.gender ?? "non renseigné"}
`.trim();

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // llama-3.3-70b-versatile was deprecated by Groq
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userMessage },
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
    const parsed = JSON.parse(content) as GroqProjection;

    const projectedTargetDate  = parsed.projectedTargetDate ?? null;
    const projectedWeeklyLossKg = parsed.weeklyLossKg ?? null;
    const projectedNote        = parsed.note ?? null;

    // Build updated plan with projection data
    const updatedPlan: NutritionPlan = {
      ...plan,
      projectedTargetDate:   projectedTargetDate  ?? undefined,
      projectedWeeklyLossKg: projectedWeeklyLossKg ?? undefined,
      projectedNote:         projectedNote         ?? undefined,
    };

    // Save to Firestore via goals.plan
    const db = getAdminFirestore();
    await db.doc(`users/${session.userId}`).set(
      { goals: { plan: updatedPlan } },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      projectedTargetDate,
      projectedWeeklyLossKg,
      projectedNote,
    });
  } catch (e) {
    console.error("Projection error:", e);
    return NextResponse.json({ error: "Projection failed" }, { status: 500 });
  }
}
