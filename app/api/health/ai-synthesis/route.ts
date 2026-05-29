export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { HealthEntry, DayLog, FitnessDay, UserProfile } from "@/app/lib/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un médecin généraliste bienveillant et expert en médecine interne francophone.
On te fournit les données de santé complètes d'un patient pour une journée donnée : symptômes, médicaments, constantes vitales, données d'activité physique et nutrition.

Analyse l'ensemble de ces données et retourne UNIQUEMENT un objet JSON valide (sans markdown, sans texte avant/après) avec exactement ces champs :

- alertLevel: "vert" | "orange" | "rouge"
  (vert = situation normale, orange = à surveiller, rouge = consultation recommandée)
- alertLabel: string
  (label court : "Situation normale" / "À surveiller" / "Consultation recommandée")
- summary: string
  (synthèse globale en 2-3 phrases, directe et factuelle, sans intro générique)
- vitaux: string
  (analyse des constantes vitales en 1-2 phrases : tension, FC, SpO2, glycémie, temp — mention UNIQUEMENT celles fournies)
- symptomes: string | null
  (analyse des symptômes déclarés et de leur cohérence avec les constantes, null si aucun symptôme)
- nutrition: string
  (1-2 phrases sur l'alimentation du jour : apport calorique, hydratation, protéines — en lien avec l'état général)
- activite: string | null
  (1 phrase sur l'activité physique du jour, null si pas de données)
- recommandations: string[]
  (exactement 3 recommandations concrètes et personnalisées, courtes, actionnables aujourd'hui)
- consulter: string | null
  (message d'alerte si consultation médicale recommandée, null sinon — sois conservateur, n'alerte que si vraiment justifié)

Règles importantes :
- Ne jamais diagnostiquer formellement
- Ne jamais affirmer qu'il s'agit d'une maladie précise
- Toujours rester encourageant même en cas d'alerte
- Si les données sont insuffisantes, analyser ce qui est disponible
- Les recommandations doivent être pratiques et réalisables dans la journée
- Réponds uniquement en JSON valide`;

// ─── Route ───────────────────────────────────────────────────────────────────

export interface AISynthesisResult {
  alertLevel:      "vert" | "orange" | "rouge";
  alertLabel:      string;
  summary:         string;
  vitaux:          string;
  symptomes:       string | null;
  nutrition:       string;
  activite:        string | null;
  recommandations: string[];
  consulter:       string | null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  let body: { date: string };
  try {
    body = await req.json() as { date: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db      = getAdminFirestore();
  const userId  = session.userId;

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  const [healthSnap, foodSnap, fitnessSnap, profileSnap] = await Promise.all([
    db.doc(`users/${userId}/healthLog/${date}`).get(),
    db.doc(`users/${userId}/foodLog/${date}`).get(),
    db.doc(`users/${userId}/fitnessData/${date}`).get(),
    db.doc(`users/${userId}`).get(),
  ]);

  const health  = healthSnap.exists  ? (healthSnap.data()  as HealthEntry)  : null;
  const food    = foodSnap.exists    ? (foodSnap.data()    as DayLog)        : null;
  const fitness = fitnessSnap.exists ? (fitnessSnap.data() as FitnessDay)   : null;
  const profile = profileSnap.exists ? (profileSnap.data() as UserProfile)  : null;

  const goals  = profile?.goals ?? defaultGoals();
  const age    = null; // age not stored in profile currently
  const gf     = fitness?.googleFit;
  const wi     = fitness?.withings;

  // ── Build the clinical context ─────────────────────────────────────────────

  // Vital signs
  const bpReadings = health?.bloodPressure ?? [];
  const avgBP = bpReadings.length
    ? {
        sys: Math.round(bpReadings.reduce((s, r) => s + r.systolic,  0) / bpReadings.length),
        dia: Math.round(bpReadings.reduce((s, r) => s + r.diastolic, 0) / bpReadings.length),
        pulse: bpReadings[bpReadings.length - 1]?.pulse ?? null,
      }
    : null;

  const vitauxLines: string[] = [];
  if (avgBP)                  vitauxLines.push(`Tension artérielle : ${avgBP.sys}/${avgBP.dia} mmHg${avgBP.pulse ? ` (pouls ${avgBP.pulse} bpm)` : ""}`);
  if (health?.restingHR)      vitauxLines.push(`FC repos : ${health.restingHR} bpm`);
  if (gf?.heartRateAvg)       vitauxLines.push(`FC moyenne (Google Fit) : ${gf.heartRateAvg} bpm`);
  if (health?.spO2)           vitauxLines.push(`SpO2 : ${health.spO2}%`);
  if (health?.bloodGlucose)   vitauxLines.push(`Glycémie : ${health.bloodGlucose} mmol/L`);
  if (health?.temperatureC)   vitauxLines.push(`Température : ${health.temperatureC}°C`);
  if (wi?.weightKg)           vitauxLines.push(`Poids : ${wi.weightKg} kg${wi.bodyFatPct ? ` — masse grasse : ${wi.bodyFatPct}%` : ""}`);

  // Activity
  const activityLines: string[] = [];
  if (gf?.steps)                  activityLines.push(`Pas : ${gf.steps.toLocaleString("fr-FR")} (objectif : ${(goals as { stepsGoal?: number }).stepsGoal ?? 10000})`);
  if (gf?.activeMinutes)          activityLines.push(`Minutes actives : ${gf.activeMinutes} min`);
  if (gf?.activeCaloriesBurned)   activityLines.push(`Calories brûlées : ${gf.activeCaloriesBurned} kcal`);
  if (gf?.sleepMinutes)           activityLines.push(`Sommeil : ${Math.floor(gf.sleepMinutes / 60)}h${gf.sleepMinutes % 60 > 0 ? String(gf.sleepMinutes % 60).padStart(2, "0") : ""}`);

  // Nutrition
  const totals = food?.totals;
  const nutritionLines: string[] = [];
  if (totals) {
    nutritionLines.push(`Calories : ${Math.round(totals.calories)} / ${goals.dailyCalories} kcal`);
    nutritionLines.push(`Protéines : ${Math.round(totals.proteinG)} / ${goals.proteinGrams} g`);
    nutritionLines.push(`Glucides : ${Math.round(totals.carbsG)} / ${goals.carbsGrams} g`);
    nutritionLines.push(`Lipides : ${Math.round(totals.fatG)} / ${goals.fatGrams} g`);
    nutritionLines.push(`Fibres : ${Math.round(totals.fiberG ?? 0)} / ${goals.fiberGrams} g`);
  }
  if (food?.waterMl !== undefined) nutritionLines.push(`Hydratation : ${food.waterMl} mL / ${goals.waterMl ?? 2000} mL`);

  // Symptoms
  const symptoms   = health?.symptoms    ?? [];
  const medications = health?.medications ?? [];

  const symLines = symptoms.map(s => `- ${s.name} (${s.category}) — sévérité : ${s.severity ?? "modéré"}`);
  const medLines = medications.map(m => `- ${m.name}${m.dose ? ` ${m.dose}` : ""}${m.taken ? " ✓ pris" : " (non pris)"}`);

  // ── Compose the user message ───────────────────────────────────────────────

  const userMsg = `
Date : ${date}
${age ? `Âge patient : ${age} ans` : ""}

=== CONSTANTES VITALES ===
${vitauxLines.length ? vitauxLines.join("\n") : "Aucune constante saisie ce jour"}

=== SYMPTÔMES DÉCLARÉS ===
${symLines.length ? symLines.join("\n") : "Aucun symptôme déclaré"}

=== MÉDICAMENTS DU JOUR ===
${medLines.length ? medLines.join("\n") : "Aucun médicament renseigné"}

=== NUTRITION ===
${nutritionLines.length ? nutritionLines.join("\n") : "Aucun aliment enregistré"}

=== ACTIVITÉ PHYSIQUE ===
${activityLines.length ? activityLines.join("\n") : "Aucune donnée d'activité"}
`.trim();

  // ── Call Groq ──────────────────────────────────────────────────────────────
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userMsg },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq synthesis error:", err);
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as AISynthesisResult;

    return NextResponse.json({ ok: true, ...parsed });
  } catch (e) {
    console.error("AI synthesis error:", e);
    return NextResponse.json({ error: "Synthesis failed" }, { status: 500 });
  }
}
