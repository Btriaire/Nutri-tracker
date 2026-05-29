export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type InsightType = "journal" | "dashboard" | "activity" | "progress";

// ─── System prompts per context ───────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<InsightType, string> = {
  journal: `Tu es un nutritionniste bienveillant. On te donne le journal alimentaire du jour et les objectifs.
Rédige une analyse nutritionnelle factuelle, succincte et positive, en 2-3 phrases maximum.
Compare les apports réels aux objectifs (calories, protéines, glucides, lipides, fibres, eau).
Identifie 1 point fort et 1 piste d'amélioration si nécessaire.
Réponds directement sans intro ni conclusion générique.`,

  dashboard: `Tu es un coach santé bienveillant mais ambitieux. On te donne un bilan de la journée.
Analyse la situation du jour (sommeil, calories, activité, pas, FC, hydratation) en 2-3 phrases factuelles et positives.
Si un plan est actif, mets les résultats en perspective par rapport aux objectifs du plan.
Termine sur une note motivante et concrète pour la suite.
Réponds directement sans intro ni conclusion générique.`,

  activity: `Tu es un coach sportif expert. On te donne les données d'activité du jour.
Analyse les performances comme un vrai coach : durée, intensité, calories brûlées, pas, minutes actives.
Compare aux objectifs d'activité fixés. Sois factuel, précis, motivant.
2-3 phrases maximum. Propose une observation concrète ou un conseil.
Réponds directement sans intro ni conclusion générique.`,

  progress: `Tu es un expert en suivi santé et performance. On te donne des données de tendance sur plusieurs semaines.
Fais une mise en perspective long terme de tous les paramètres (poids, calories, activité, sommeil, FC) en 3-4 phrases.
Identifie les tendances positives et les axes de progression. Sois factuel, optimiste et motivant.
Réponds directement sans intro ni conclusion générique.`,
};

// ─── User message builders ────────────────────────────────────────────────────

function buildUserMessage(type: InsightType, data: Record<string, unknown>): string {
  switch (type) {
    case "journal": {
      const { entries, totals, goals, waterMl, waterGoal } = data as {
        entries:  { name: string; grams: number; calories: number }[];
        totals:   { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
        goals:    { dailyCalories: number; proteinGrams: number; carbsGrams: number; fatGrams: number; fiberGrams: number };
        waterMl:  number;
        waterGoal: number;
      };
      const foodList = (entries ?? [])
        .slice(0, 20)
        .map((e) => `- ${e.name} (${e.grams}g, ${e.calories} kcal)`)
        .join("\n");
      return `Aliments consommés aujourd'hui :
${foodList || "Aucun aliment enregistré"}

Totaux :
- Calories : ${Math.round(totals?.calories ?? 0)} / ${goals?.dailyCalories ?? 0} kcal
- Protéines : ${Math.round(totals?.proteinG ?? 0)} / ${goals?.proteinGrams ?? 0} g
- Glucides : ${Math.round(totals?.carbsG ?? 0)} / ${goals?.carbsGrams ?? 0} g
- Lipides : ${Math.round(totals?.fatG ?? 0)} / ${goals?.fatGrams ?? 0} g
- Fibres : ${Math.round(totals?.fiberG ?? 0)} / ${goals?.fiberGrams ?? 0} g
- Eau : ${waterMl ?? 0} / ${waterGoal ?? 2000} mL`;
    }

    case "dashboard": {
      const d = data as {
        sleepMinutes: number | null; sleepGoalMin: number;
        caloriesConsumed: number; caloriesGoal: number;
        burned: number | null; steps: number | null; stepsGoal: number;
        activeMinutes: number | null; heartRate: number | null;
        waterMl: number; waterGoal: number;
        weightKg: number | null; targetWeightKg: number | null;
        planLabel?: string; planDay?: number; planEmoji?: string;
        projectedTargetDate?: string;
      };
      return `Bilan du jour :
- Sommeil : ${d.sleepMinutes !== null ? `${Math.round((d.sleepMinutes ?? 0) / 60 * 10) / 10}h` : "non renseigné"} (objectif : ${Math.round((d.sleepGoalMin ?? 480) / 60 * 10) / 10}h)
- Calories consommées : ${d.caloriesConsumed} / ${d.caloriesGoal} kcal
- Calories brûlées (activité) : ${d.burned !== null ? `${d.burned} kcal` : "non renseigné"}
- Pas : ${d.steps !== null ? d.steps.toLocaleString("fr-FR") : "non renseigné"} (objectif : ${d.stepsGoal?.toLocaleString("fr-FR")})
- Minutes actives : ${d.activeMinutes !== null ? `${d.activeMinutes} min` : "non renseigné"}
- Fréquence cardiaque moyenne : ${d.heartRate !== null ? `${d.heartRate} bpm` : "non renseigné"}
- Hydratation : ${d.waterMl} / ${d.waterGoal} mL
- Poids actuel : ${d.weightKg !== null ? `${d.weightKg} kg` : "non renseigné"}${d.targetWeightKg ? ` (cible : ${d.targetWeightKg} kg)` : ""}
${d.planLabel ? `- Plan actif : ${d.planEmoji ?? ""} ${d.planLabel} — Jour ${d.planDay ?? 1}${d.projectedTargetDate ? ` — cible visée le ${d.projectedTargetDate}` : ""}` : "Aucun plan actif"}`;
    }

    case "activity": {
      const d = data as {
        sessions: { name: string; durationMin: number; calories: number | null }[];
        manualActivities: { name: string; durationMin: number; caloriesBurned: number | null }[];
        steps: number | null; activeMinutes: number | null; burned: number | null;
        stepsGoal: number; activityPlan?: { sessionsPerWeek: number; weeklyKcalBurned: number };
      };
      const allSessions = [
        ...(d.sessions ?? []).map((s) => `- ${s.name} : ${s.durationMin} min${s.calories ? `, ${s.calories} kcal` : ""}`),
        ...(d.manualActivities ?? []).map((a) => `- ${a.name} : ${a.durationMin} min${a.caloriesBurned ? `, ${a.caloriesBurned} kcal` : ""}`),
      ];
      return `Activités du jour :
${allSessions.length ? allSessions.join("\n") : "Aucune activité enregistrée"}

Métriques :
- Pas : ${d.steps !== null ? d.steps.toLocaleString("fr-FR") : "—"} (objectif : ${d.stepsGoal?.toLocaleString("fr-FR")})
- Minutes actives : ${d.activeMinutes !== null ? `${d.activeMinutes} min` : "—"}
- Calories brûlées : ${d.burned !== null ? `${d.burned} kcal` : "—"}
${d.activityPlan ? `- Plan activité : ${d.activityPlan.sessionsPerWeek} séances/sem, ~${d.activityPlan.weeklyKcalBurned} kcal/sem` : ""}`;
    }

    case "progress": {
      const d = data as {
        days: number;
        avgCalories: number; avgSteps: number; avgSleepH: number; avgHR: number | null;
        startWeight: number | null; currentWeight: number | null; targetWeight: number | null;
        weightTrend: "down" | "up" | "stable";
        plan?: { label: string; emoji: string; day: number; projectedDate?: string; weeklyLoss?: number };
        calorieGoal: number; stepsGoal: number; sleepGoalH: number;
      };
      return `Analyse sur les ${d.days} derniers jours :
- Calories moyennes : ${Math.round(d.avgCalories)} kcal/j (objectif : ${d.calorieGoal} kcal)
- Pas moyens : ${Math.round(d.avgSteps).toLocaleString("fr-FR")}/j (objectif : ${d.stepsGoal?.toLocaleString("fr-FR")})
- Sommeil moyen : ${d.avgSleepH.toFixed(1)}h (objectif : ${d.sleepGoalH}h)
${d.avgHR ? `- FC moyenne : ${Math.round(d.avgHR)} bpm` : ""}
- Poids de départ : ${d.startWeight ?? "—"} kg → actuel : ${d.currentWeight ?? "—"} kg (cible : ${d.targetWeight ?? "—"} kg)
- Tendance poids : ${d.weightTrend === "down" ? "↘ en baisse" : d.weightTrend === "up" ? "↗ en hausse" : "→ stable"}
${d.plan ? `- Plan : ${d.plan.emoji} ${d.plan.label} — Jour ${d.plan.day}${d.plan.weeklyLoss ? ` — perte estimée : ${d.plan.weeklyLoss} kg/sem` : ""}${d.plan.projectedDate ? ` — objectif le ${d.plan.projectedDate}` : ""}` : ""}`;
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  let body: { type: InsightType; data: Record<string, unknown> };
  try {
    body = await req.json() as { type: InsightType; data: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, data } = body;
  if (!["journal", "dashboard", "activity", "progress"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const userMessage = buildUserMessage(type, data);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 200,
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[type] },
          { role: "user",   content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq insight error:", err);
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const groqData = await res.json() as { choices: { message: { content: string } }[] };
    const insight = groqData.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ insight });
  } catch (e) {
    console.error("Insight error:", e);
    return NextResponse.json({ error: "Insight failed" }, { status: 500 });
  }
}
