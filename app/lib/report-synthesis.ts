import type { ReportData } from "./report-builder";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface FoodVerdict {
  name:   string;
  raison: string;
}

export interface ReportSynthesis {
  resume:              string;   // 2-3 phrases, vue d'ensemble
  habitudes:           string;   // patterns observés sur la période
  evolution:           string;   // comparaison / tendance sur la période
  defis:               string[]; // 2-4 défis concrets identifiés
  propositions:        string[]; // 2-4 actions concrètes pour la période suivante
  bonnesHabitudes:     string[]; // 2-4 bonnes habitudes alimentaires observées, concrètes
  mauvaisesHabitudes:  string[]; // 2-4 mauvaises habitudes alimentaires observées, concrètes
  alimentsAFavoriser:  FoodVerdict[]; // aliments réellement consommés à privilégier davantage, avec raison
  alimentsAEviter:     FoodVerdict[]; // aliments réellement consommés à limiter/éviter, avec raison
}

const SYSTEM_PROMPT = `Tu es un médecin nutritionniste qui rédige la synthèse finale d'un rapport de suivi santé destiné à être partagé avec le patient ET potentiellement son médecin/nutritionniste traitant.

On te donne un résumé chiffré complet d'une période de suivi (nutrition, activité, micronutriments, suppléments, poids, constantes vitales, symptômes, scan visage).

On te donne aussi la liste des aliments réellement consommés pendant la période, avec leur fréquence et leur profil nutritionnel moyen par portion (calories, sucre, sodium, graisses saturées, fibres).

Rédige une synthèse structurée, factuelle, professionnelle mais accessible, en français. Réponds UNIQUEMENT en JSON valide avec exactement ces clés :
{
  "resume": "2-3 phrases de vue d'ensemble de la période, ton neutre et factuel",
  "habitudes": "2-3 phrases décrivant les habitudes générales observées (régularité des repas, hydratation, activité, sommeil, observance des suppléments)",
  "evolution": "2-3 phrases sur l'évolution constatée sur la période (poids, tendance calorique, activité) — si les données sont insuffisantes pour conclure, dis-le clairement",
  "defis": ["2 à 4 défis concrets et spécifiques identifiés à partir des chiffres fournis, ex: carences en vitamine D, hydratation insuffisante 4 jours sur 7"],
  "propositions": ["2 à 4 actions concrètes et réalistes pour la période suivante, directement liées aux défis identifiés"],
  "bonnesHabitudes": ["2 à 4 bonnes habitudes alimentaires concrètes observées dans la liste des aliments consommés, ex: consommation régulière de légumes verts, bon apport en légumineuses"],
  "mauvaisesHabitudes": ["2 à 4 mauvaises habitudes alimentaires concrètes observées, ex: grignotage fréquent de produits sucrés en fin de journée, consommation régulière de plats ultra-transformés"],
  "alimentsAFavoriser": [{"name": "nom exact de l'aliment tel que fourni", "raison": "1 phrase courte expliquant pourquoi le favoriser davantage (nutriment fort, faible densité calorique, fibres, etc.)"}],
  "alimentsAEviter": [{"name": "nom exact de l'aliment tel que fourni", "raison": "1 phrase courte expliquant pourquoi le limiter (sucre, sodium, graisses saturées, densité calorique élevée, fréquence trop haute)"}]
}

RÈGLES :
- Base-toi UNIQUEMENT sur les données fournies, ne les invente pas.
- Pour alimentsAFavoriser/alimentsAEviter : choisis UNIQUEMENT parmi les aliments listés dans "Aliments consommés" fournis, utilise leur nom exact, 3 à 6 aliments par liste maximum, choisis les plus pertinents (les plus fréquents et/ou les plus marqués nutritionnellement).
- Si la liste d'aliments consommés est vide ou trop limitée pour juger, retourne des tableaux vides pour alimentsAFavoriser/alimentsAEviter plutôt que d'inventer.
- Si une catégorie de données est absente (ex: pas de scan visage), ne l'invente pas et ne la mentionne pas comme un défi.
- Reste factuel, non alarmiste, non moralisateur. Ce n'est pas un diagnostic médical.
- Les défis et propositions doivent être courts (1 phrase chacun), concrets, actionnables.
- N'ajoute aucun texte hors du JSON.`;

function buildUserMessage(data: ReportData): string {
  const lines: string[] = [];
  lines.push(`Période : ${data.meta.from} au ${data.meta.to} (${data.meta.totalDays} jours)`);

  lines.push(`\n— Nutrition (${data.nutrition.daysLogged}/${data.meta.totalDays} jours loggés) —`);
  lines.push(`Calories moy: ${data.nutrition.avgCalories} kcal/j (objectif ${data.profile.goals.dailyCalories}, ${data.nutrition.pctCalGoal}%)`);
  lines.push(`Protéines: ${data.nutrition.avgProteinG}g, Glucides: ${data.nutrition.avgCarbsG}g, Lipides: ${data.nutrition.avgFatG}g, Fibres: ${data.nutrition.avgFiberG}g`);
  lines.push(`Eau: ${data.nutrition.avgWaterMl}mL/j (objectif ${data.profile.goals.waterMl}mL, ${data.nutrition.pctWaterGoal}%)`);

  if (data.nutrition.foodFrequency.length > 0) {
    lines.push(`\n— Aliments consommés (par ordre de fréquence) —`);
    for (const f of data.nutrition.foodFrequency) {
      lines.push(`${f.name} : ${f.count}x, ${f.avgCalories}kcal/portion, sucre ${f.avgSugarG}g, sodium ${f.avgSodiumMg}mg, graisses sat. ${f.avgSaturatedFatG}g, fibres ${f.avgFiberG}g`);
    }
  }

  lines.push(`\n— Activité (${data.activity.daysWithData} jours avec données) —`);
  lines.push(`Pas moy: ${data.activity.avgSteps}/j (objectif ${data.profile.goals.stepsGoal}, ${data.activity.pctStepsGoal}%)`);
  lines.push(`Sommeil moy: ${data.activity.avgSleepH}h (objectif ${(data.profile.goals.sleepGoalMin / 60).toFixed(1)}h, ${data.activity.pctSleepGoal}%)`);

  if (data.health.weightStart !== null || data.health.weightEnd !== null) {
    lines.push(`\n— Poids —`);
    lines.push(`Début: ${data.health.weightStart}kg, Fin: ${data.health.weightEnd}kg, Delta: ${data.health.weightDelta}kg`);
    if (data.profile.goals.targetWeightKg) lines.push(`Objectif: ${data.profile.goals.targetWeightKg}kg`);
  }

  if (data.health.avgHR || data.health.avgSys) {
    lines.push(`\n— Constantes —`);
    if (data.health.avgHR) lines.push(`FC moy: ${data.health.avgHR} bpm`);
    if (data.health.avgSys) lines.push(`Tension moy: ${data.health.avgSys}/${data.health.avgDia} mmHg`);
    if (data.health.latestSpO2) lines.push(`SpO2: ${data.health.latestSpO2}%`);
  }

  if (data.health.symptomsTotal > 0) {
    lines.push(`\n— Symptômes —`);
    lines.push(`${data.health.symptomsTotal} occurrences. Top: ${data.health.topSymptoms.map(s => `${s.name} (${s.count}x)`).join(", ")}`);
  }

  if (data.supplements.productsCount > 0) {
    lines.push(`\n— Suppléments (observance ${data.supplements.overallAdherencePct}%) —`);
    for (const p of data.supplements.perProduct) {
      lines.push(`${p.name}: ${p.adherencePct}% (${p.actualTotal}/${p.expectedTotal} prises, ${p.daysMissed}j manqués)`);
    }
  }

  if (data.micronutrients.perNutrient.length > 0) {
    lines.push(`\n— Micronutriments vs AJR —`);
    if (data.micronutrients.deficiencies.length > 0) {
      lines.push(`Carences (<70% AJR): ${data.micronutrients.deficiencies.map(d => `${d.label} (${d.pctRda}%)`).join(", ")}`);
    }
    const excess = data.micronutrients.perNutrient.filter(n => n.status === "exces");
    if (excess.length > 0) lines.push(`Excès (>150% AJR): ${excess.map(d => `${d.label} (${d.pctRda}%)`).join(", ")}`);
  }

  if (data.faceScan.scansCount > 0 && data.faceScan.delta) {
    lines.push(`\n— Scan visage (${data.faceScan.scansCount} scans) —`);
    const d = data.faceScan.delta;
    lines.push(`Évolution 1er→dernier: amaigrissement ${d.amaigrissement >= 0 ? "+" : ""}${d.amaigrissement}, fatigue ${d.fatigue >= 0 ? "+" : ""}${d.fatigue}, teint ${d.teint >= 0 ? "+" : ""}${d.teint}, hydratation ${d.hydratation >= 0 ? "+" : ""}${d.hydratation} (échelle 1-5)`);
  }

  return lines.join("\n");
}

export async function generateReportSynthesis(data: ReportData): Promise<ReportSynthesis | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // llama-3.3-70b-versatile was deprecated by Groq
        reasoning_effort: "low",
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: buildUserMessage(data) },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[report-synthesis] Groq error", await res.text());
      return null;
    }

    const groqData = await res.json() as { choices: { message: { content: string } }[] };
    const raw = groqData.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(raw) as ReportSynthesis;

    if (!parsed.resume || !Array.isArray(parsed.defis) || !Array.isArray(parsed.propositions)) return null;
    return parsed;
  } catch (e) {
    console.error("[report-synthesis] failed", e);
    return null;
  }
}
