export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type InsightType = "journal" | "dashboard" | "activity" | "progress";

// ─── Time-of-day context ──────────────────────────────────────────────────────

function timeContext(hour: number): string {
  if (hour >= 5  && hour < 10) return "MATIN TÔTOT (entre 5h et 10h) — la journée démarre à peine. Les données sont très partielles. Ne juge pas les apports comme insuffisants : c'est normal à cette heure. Concentre-toi sur le sommeil, le démarrage et donne une intention positive pour la journée.";
  if (hour >= 10 && hour < 13) return "MATINÉE (entre 10h et 13h) — la journée est bien entamée mais loin d'être finie. Les données alimentaires sont probablement partielles. Pondère tes remarques en conséquence, reste encourageant pour la suite.";
  if (hour >= 13 && hour < 17) return "APRÈS-MIDI (entre 13h et 17h) — la moitié de la journée est passée. Les données sont relativement représentatives. Tu peux faire une analyse plus complète tout en restant positif sur la suite.";
  if (hour >= 17 && hour < 21) return "FIN DE JOURNÉE (entre 17h et 21h) — la journée est quasi complète. Les données sont représentatives. Tu peux faire un bilan complet et précis.";
  return "SOIRÉE / NUIT (après 21h ou avant 5h) — la journée est terminée ou presque. Fais un bilan complet. Si des données manquent, c'est qu'elles n'ont pas été saisies.";
}

// ─── System prompts per context ───────────────────────────────────────────────

function buildSystemPrompt(type: InsightType, hour: number): string {
  const ctx = timeContext(hour);
  const timeNote = `\n\nCONTEXTE TEMPOREL : ${ctx}`;

  const base: Record<InsightType, string> = {
    journal: `Tu es un nutritionniste bienveillant. On te donne le journal alimentaire du jour, les objectifs et les niveaux de faim ressentis par repas.
Rédige une analyse en 3 parties courtes :
1. Bilan nutritionnel : compare calories, protéines, glucides, lipides, fibres et eau aux objectifs.
2. Sensations de faim (UNIQUEMENT si des niveaux de faim sont fournis) : analyse le pattern de faim. Une faim élevée (4-5) avant un repas = repas précédent trop léger ou timing à ajuster. Une faim basse (1-2) = bon équilibre ou repas trop lourd. Grignotages avec faim élevée = signal métabolique à prendre au sérieux.
3. 1 point fort + 1 conseil concret.
Total : 3-4 phrases maximum. Réponds directement sans intro générique.`,

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

  // Progress is long-term → time of day is less relevant, skip the note
  if (type === "progress") return base[type];
  return base[type] + timeNote;
}

// ─── User message builders ────────────────────────────────────────────────────

function buildUserMessage(type: InsightType, data: Record<string, unknown>): string {
  const hour = typeof data._hourOfDay === "number" ? data._hourOfDay : new Date().getHours();
  const timeLabel = hour >= 5 && hour < 10 ? `🕐 Il est ${hour}h — début de matinée`
    : hour >= 10 && hour < 13 ? `🕙 Il est ${hour}h — matinée`
    : hour >= 13 && hour < 17 ? `🕑 Il est ${hour}h — après-midi`
    : hour >= 17 && hour < 21 ? `🕔 Il est ${hour}h — fin de journée`
    : `🌙 Il est ${hour}h — soirée/nuit`;
  const timePrefix = type !== "progress" ? `${timeLabel}\n\n` : "";
  void hour; // used above
  switch (type) {
    case "journal": {
      const { entries, totals, goals, waterMl, waterGoal, mealHunger } = data as {
        entries:    { name: string; grams: number; calories: number }[];
        totals:     { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
        goals:      { dailyCalories: number; proteinGrams: number; carbsGrams: number; fatGrams: number; fiberGrams: number };
        waterMl:    number;
        waterGoal:  number;
        mealHunger?: Partial<Record<string, number>>;
      };
      const HUNGER_LABELS: Record<number, string> = {
        1: "pas faim (1/5)",
        2: "peu faim (2/5)",
        3: "modéré (3/5)",
        4: "faim (4/5)",
        5: "très faim (5/5)",
      };
      const MEAL_NAMES: Record<string, string> = {
        breakfast: "Petit-déjeuner",
        lunch:     "Déjeuner",
        dinner:    "Dîner",
        snacks:    "Collations",
      };
      const hungerLines = mealHunger
        ? Object.entries(mealHunger)
            .filter(([, v]) => v != null)
            .map(([meal, v]) => `  - ${MEAL_NAMES[meal] ?? meal} : ${HUNGER_LABELS[v as number] ?? v}`)
            .join("\n")
        : "";
      const foodList = (entries ?? [])
        .slice(0, 20)
        .map((e) => `- ${e.name} (${e.grams}g, ${e.calories} kcal)`)
        .join("\n");
      return `${timePrefix}Aliments consommés aujourd'hui :
${foodList || "Aucun aliment enregistré"}

Totaux :
- Calories : ${Math.round(totals?.calories ?? 0)} / ${goals?.dailyCalories ?? 0} kcal
- Protéines : ${Math.round(totals?.proteinG ?? 0)} / ${goals?.proteinGrams ?? 0} g
- Glucides : ${Math.round(totals?.carbsG ?? 0)} / ${goals?.carbsGrams ?? 0} g
- Lipides : ${Math.round(totals?.fatG ?? 0)} / ${goals?.fatGrams ?? 0} g
- Fibres : ${Math.round(totals?.fiberG ?? 0)} / ${goals?.fiberGrams ?? 0} g
- Eau : ${waterMl ?? 0} / ${waterGoal ?? 2000} mL
${hungerLines ? `\nNiveaux de faim ressentis :\n${hungerLines}` : ""}`;
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
      return `${timePrefix}Bilan du jour :
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
      return `${timePrefix}Activités du jour :
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

  const hour        = typeof data._hourOfDay === "number" ? (data._hourOfDay as number) : new Date().getHours();
  const systemPrompt = buildSystemPrompt(type, hour);
  const userMessage  = buildUserMessage(type, data);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
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
