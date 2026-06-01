export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { FieldPath } from "firebase-admin/firestore";
import { format, subDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { DayLog, FitnessDay, HealthEntry, ManualActivity } from "@/app/lib/types";

const USER    = "owner";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type Period = "7d" | "1m" | "3m";

function periodDays(p: Period): number {
  if (p === "7d") return 7;
  if (p === "1m") return 30;
  return 90;
}

function avg(arr: number[]): number | null {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") ?? "7d") as Period;
  const days   = periodDays(period);
  const today  = format(new Date(), "yyyy-MM-dd");
  const from   = format(subDays(new Date(), days), "yyyy-MM-dd");

  const db = getAdminFirestore();

  const [logSnap, fitnessSnap, healthSnap, actSnap] = await Promise.all([
    db.collection(`users/${USER}/foodLog`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", today)
      .get(),
    db.collection(`users/${USER}/fitnessData`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", today)
      .get(),
    db.collection(`users/${USER}/healthLog`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", today)
      .get(),
    db.collection(`users/${USER}/manualActivities`)
      .where("date", ">=", from)
      .where("date", "<=", today)
      .get(),
  ]);

  // ── Nutrition aggregation ──────────────────────────────────────────────────
  const calArr: number[] = [], protArr: number[] = [], carbArr: number[] = [],
        fatArr: number[]  = [], fiberArr: number[] = [], waterArr: number[] = [];

  for (const d of logSnap.docs) {
    const log = d.data() as DayLog;
    if ((log.totals?.calories ?? 0) > 0) {
      calArr.push(log.totals!.calories);
      protArr.push(log.totals!.proteinG ?? 0);
      carbArr.push(log.totals!.carbsG ?? 0);
      fatArr.push(log.totals!.fatG ?? 0);
      fiberArr.push(log.totals!.fiberG ?? 0);
    }
    if ((log.waterMl ?? 0) > 0) waterArr.push(log.waterMl!);
  }

  // ── Fitness aggregation ────────────────────────────────────────────────────
  const weightArr: number[] = [], stepsArr: number[] = [], sleepArr: number[] = [],
        hrArr: number[]      = [], burnedArr: number[] = [], activeMinArr: number[] = [];

  for (const d of fitnessSnap.docs) {
    const fd = d.data() as FitnessDay;
    const w  = fd.withings?.weightKg ?? fd.googleFit?.weightKg;
    const gf = fd.googleFit;
    if (w) weightArr.push(w);
    if (gf?.steps)               stepsArr.push(gf.steps);
    if (gf?.sleepMinutes)        sleepArr.push(gf.sleepMinutes);
    if (gf?.heartRateAvg)        hrArr.push(gf.heartRateAvg);
    if (gf?.activeCaloriesBurned) burnedArr.push(gf.activeCaloriesBurned);
    if (gf?.activeMinutes)       activeMinArr.push(gf.activeMinutes);
  }

  // ── Blood pressure ─────────────────────────────────────────────────────────
  const bpReadings: { sys: number; dia: number }[] = [];
  for (const d of healthSnap.docs) {
    const h = d.data() as HealthEntry;
    const readings = h.bloodPressure ?? [];
    if (readings.length > 0) {
      const sys = Math.round(readings.reduce((s, r) => s + r.systolic,  0) / readings.length);
      const dia = Math.round(readings.reduce((s, r) => s + r.diastolic, 0) / readings.length);
      bpReadings.push({ sys, dia });
    }
  }
  const avgBpSys = avg(bpReadings.map(b => b.sys));
  const avgBpDia = avg(bpReadings.map(b => b.dia));

  // ── Activities ─────────────────────────────────────────────────────────────
  const activityCounts: Record<string, number> = {};
  let totalActivityKcal = 0, totalActivityMin = 0;
  for (const d of actSnap.docs) {
    const a = d.data() as ManualActivity;
    const name = a.name ?? "Activité";
    activityCounts[name] = (activityCounts[name] ?? 0) + 1;
    totalActivityKcal += a.caloriesBurned ?? 0;
    totalActivityMin  += a.durationMin ?? 0;
  }
  const topActivities = Object.entries(activityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (×${count})`);

  // ── Weight trend ───────────────────────────────────────────────────────────
  const sortedWeights = weightArr.slice();
  const firstW = sortedWeights[0] ?? null;
  const lastW  = sortedWeights[sortedWeights.length - 1] ?? null;
  const weightDelta = firstW && lastW ? Math.round((lastW - firstW) * 100) / 100 : null;

  // ── Build prompt ───────────────────────────────────────────────────────────
  const periodLabel = period === "7d" ? "7 derniers jours" : period === "1m" ? "30 derniers jours" : "3 derniers mois";
  const logDays     = logSnap.size;
  const fitDays     = fitnessSnap.size;

  const userMsg = `Analyse holistique — ${periodLabel}

📅 Données disponibles : ${logDays} jours de nutrition, ${fitDays} jours d'activité/santé

🍽️ NUTRITION (${calArr.length} jours loggués)
- Calories moy. : ${avg(calArr) ?? "—"} kcal/j
- Protéines moy. : ${avg(protArr) ?? "—"} g/j
- Glucides moy. : ${avg(carbArr) ?? "—"} g/j
- Lipides moy. : ${avg(fatArr) ?? "—"} g/j
- Fibres moy. : ${avg(fiberArr) ?? "—"} g/j
- Eau moy. : ${waterArr.length ? Math.round(avg(waterArr)! / 10) / 100 : "—"} L/j

⚖️ POIDS
- Début de période : ${firstW ? `${firstW} kg` : "—"}
- Fin de période : ${lastW ? `${lastW} kg` : "—"}
- Variation : ${weightDelta !== null ? `${weightDelta > 0 ? "+" : ""}${weightDelta} kg` : "—"}

🏃 ACTIVITÉ
- Pas moy. : ${avg(stepsArr)?.toLocaleString("fr-FR") ?? "—"} pas/j
- Minutes actives moy. : ${avg(activeMinArr) ?? "—"} min/j
- Calories brûlées moy. : ${avg(burnedArr) ?? "—"} kcal/j
- Séances manuelles : ${actSnap.size} (${totalActivityMin} min, ${totalActivityKcal} kcal)
- Activités principales : ${topActivities.length ? topActivities.join(", ") : "aucune"}

😴 SOMMEIL
- Durée moy. : ${sleepArr.length ? `${Math.floor((avg(sleepArr)! / 60))}h${String(avg(sleepArr)! % 60).padStart(2, "0")}` : "—"}/nuit (${sleepArr.length} nuits)

❤️ CARDIO & SANTÉ
- FC repos moy. : ${avg(hrArr) ?? "—"} bpm
- PA moy. : ${avgBpSys ? `${avgBpSys}/${avgBpDia} mmHg` : "—"} (${bpReadings.length} mesures)`;

  const systemPrompt = `Tu es un expert en santé holistique, nutrition, sport et bien-être. On te donne un bilan complet sur ${periodLabel}.

Génère une analyse approfondie STRUCTURÉE en 5 sections courtes (2-3 phrases chacune) :

1. 🍽️ **Nutrition** — bilan macro, équilibre alimentaire, points forts et axes d'amélioration
2. ⚖️ **Poids & Composition** — tendance, interprétation, projection
3. 🏃 **Activité & Performance** — volume, régularité, qualité des séances
4. 😴 **Récupération** — sommeil et signaux de récupération
5. 🎯 **Plan d'action** — 3 actions concrètes et prioritaires pour la semaine prochaine

Ton : expert bienveillant, factuel, motivant. Utilise des emojis pour les titres. Sois précis avec les chiffres fournis.
Ne commence pas par "Bien sûr" ou "Voici". Commence directement par "🍽️ Nutrition".
Réponds en français. Maximum 300 mots.`;

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

    const res = await fetch(GROQ_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  600,
        temperature: 0.4,
        messages: [
          { role: "system",  content: systemPrompt },
          { role: "user",    content: userMsg },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const json = await res.json() as { choices: { message: { content: string } }[] };
    const text = json.choices[0]?.message?.content?.trim() ?? "";

    // Return both the analysis and the raw data for display
    return NextResponse.json({
      text,
      period,
      periodLabel,
      data: {
        logDays,
        fitDays,
        avgCalories:    avg(calArr),
        avgProtein:     avg(protArr),
        avgCarbs:       avg(carbArr),
        avgFat:         avg(fatArr),
        avgFiber:       avg(fiberArr),
        avgWaterL:      waterArr.length ? Math.round(avg(waterArr)! / 10) / 100 : null,
        firstWeight:    firstW,
        lastWeight:     lastW,
        weightDelta,
        avgSteps:       avg(stepsArr),
        avgActiveMin:   avg(activeMinArr),
        avgBurned:      avg(burnedArr),
        avgSleepMin:    avg(sleepArr),
        avgHR:          avg(hrArr),
        avgBpSys,
        avgBpDia,
        activityCount:  actSnap.size,
        activityMinTotal: totalActivityMin,
        topActivities,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
