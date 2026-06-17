import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

interface DetectedActivity {
  name:           string;
  activityType:   number;
  durationMin:    number;
  caloriesBurned: number;
}

// Google Fit activity codes recognised by the app (see /api/activity).
const ACTIVITY_CODES = `Codes activityType valides (utilise le plus proche) :
1=Course à pied, 7=Vélo, 9=Aérobic, 10=Ski, 17=Musculation, 37=Aviron,
45=Football, 46=Marche, 49=Snowboard, 54=Tennis, 55=Escaliers/Stepper,
72=Tennis de table, 74=Volley, 82=Yoga, 83=Danse, 93=Natation,
104=Boxe, 108=Pilates/Stretching, 109=Rugby, 0=Activité libre (par défaut).`;

const SYSTEM_PROMPT = `Tu es un coach sportif expert francophone. L'utilisateur DÉCRIT À VOIX HAUTE l'activité physique qu'il a faite, en langage naturel (ex: "ce matin j'ai couru 30 minutes puis fait 20 min de musculation").

Ta mission : extraire CHAQUE activité distincte, estimer sa durée en minutes et les calories brûlées (pour une personne de ~75 kg, calcul basé sur les MET).

Réponds UNIQUEMENT avec un JSON valide, sans markdown ni texte autour.

Format :
{"activities":[{"name":"Course à pied","activityType":1,"durationMin":30,"caloriesBurned":320}]}

${ACTIVITY_CODES}

Règles :
- "name" : nom court et clair en français (ex: "Course à pied", "Vélo", "Musculation haut du corps").
- "durationMin" : entier en minutes. Si non précisé, estime une durée réaliste (séance typique 30-45 min).
- "caloriesBurned" : entier, estimation cohérente avec la durée et l'intensité (MET × 75 kg × durée/60).
- N'invente pas d'activités non mentionnées. Ignore les mots de remplissage.`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY non configurée", results: [] }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Aucune description", results: [] }, { status: 400 });

  try {
    const res = await fetch(GROQ_URL, {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:           "llama-3.3-70b-versatile",
        temperature:     0.2,
        max_tokens:      1024,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Description : ${text}` },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq activity voice error:", err);
      return NextResponse.json({ error: "IA indisponible", results: [] }, { status: 502 });
    }

    const data   = await res.json() as { choices: { message: { content: string } }[] };
    const raw     = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { activities?: DetectedActivity[] };
    const activities = parsed.activities ?? [];

    const results = activities
      .filter((a) => a?.name && a.durationMin > 0)
      .map((a) => ({
        name:           a.name,
        activityType:   Number.isFinite(a.activityType) ? Math.round(a.activityType) : 0,
        durationMin:    Math.max(1, Math.round(a.durationMin)),
        caloriesBurned: a.caloriesBurned > 0 ? Math.round(a.caloriesBurned) : null,
      }));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Activity voice recognition error:", e);
    return NextResponse.json({ error: "Reconnaissance échouée", results: [] }, { status: 500 });
  }
}
