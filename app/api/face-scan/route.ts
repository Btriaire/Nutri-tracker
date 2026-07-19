export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { FaceScanEntry, FaceScanAnalysis, FaceScanFinding, FaceScanScorecard } from "@/app/lib/types";

const USER = "owner";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// meta-llama/llama-4-scout-17b-16e-instruct was deprecated by Groq — migrated to
// qwen/qwen3.6-27b, which also supports up to 5 images per request (needed for
// the current + previous scan comparison, which the old model likely rejected).
const VISION_MODEL = "qwen/qwen3.6-27b";
const MAX_IMAGE_BYTES = 500 * 1024; // 500KB per image after client-side compression

const DISCLAIMER =
  "Ceci n'est pas un diagnostic médical. Ce sont des observations visuelles générales basées sur des signes " +
  "documentés dans la littérature scientifique — elles peuvent avoir de nombreuses causes bénignes " +
  "(fatigue, lumière, angle de la photo) et ne remplacent en aucun cas un examen par un professionnel de " +
  "santé. Consulte un médecin pour toute observation qui te préoccupe ou persiste. Une seule photo du " +
  "visage ne permet pas un examen de près (ex. paupière inférieure tirée) — certains signes ne peuvent " +
  "être évalués qu'avec une confiance faible dans ces conditions.";

const SYSTEM_PROMPT = `Tu es un assistant qui décrit des observations visuelles générales sur une photo de visage, à des fins d'auto-suivi bien-être — PAS un outil de diagnostic médical. Une seule photo de visage (pas de gros plan dédié sur l'œil) t'est fournie.

Concentre-toi sur 4 axes, tous basés sur des traits/signes visuels documentés dans la littérature scientifique (anatomie faciale, dermatologie, médecine du sommeil), avec une confiance réaliste selon ce qui est réellement visible :

1. PERTE DE GRAISSE FACIALE / AMAIGRISSEMENT (pertinent pour un suivi de poids) :
   - Comblement des joues (fonte de la boule de Bichat / buccal fat pad) — creusement notable des joues
   - Fonte temporale (creux visibles aux tempes) — signe classique associé à une perte de poids marquée ou rapide
   - Définition accrue de la mâchoire/pommettes (moins de tissu adipeux sous-cutané)
   - Réduction de la graisse sous-mentale (double menton moins marqué)
   - Sillons nasogéniens plus creusés
   IMPORTANT : ne donne JAMAIS un pourcentage de graisse corporelle ou une estimation de poids — décris uniquement ce qui est visuellement observable ("joues qui semblent plus creusées que...", jamais un chiffre.

2. FATIGUE :
   - Cernes ou poches périorbitaires marquées
   - Teint terne ou grisâtre
   - Léger affaissement des paupières (ptosis), surtout si asymétrique ou nouveau

3. SANTÉ GÉNÉRALE / TEINT :
   - Pâleur cutanée générale — associée à l'anémie ou la fatigue
   - Ictère (jaunissement de la peau ou du blanc des yeux) — associé à une hyperbilirubinémie
   - Xanthélasma (plaques jaunâtres sur les paupières) — associé à une hyperlipidémie
   - Arc cornéen visible (anneau gris-blanc autour de l'iris) — associé à une hyperlipidémie, surtout avant 45 ans
   - Sécheresse cutanée ou rougeurs diffuses — carence nutritionnelle/hydrique possible, faible spécificité
   - Asymétrie faciale ou affaissement d'un côté — signe d'alerte AVC (protocole FAST), à signaler avec la plus grande prudence
   - Cyanose périorale (bleuissement autour des lèvres)
   - Éruption malaire ("masque de loup", rougeur sur joues/nez) — associée au lupus
   - Amincissement du tiers externe des sourcils — parfois associé à une hypothyroïdie

4. COMPARAISON DANS LE TEMPS (le plus fiable scientifiquement) : si une photo précédente est fournie, c'est la comparaison DIRECTE entre les deux qui a le plus de valeur — un visage isolé varie énormément d'une personne à l'autre, alors qu'une évolution du MÊME visage (volume des joues, creux temporal, définition de la mâchoire, cernes, teint) est un signal beaucoup plus fiable de changement réel.

Retourne UNIQUEMENT un JSON valide (sans markdown) avec :
{
  "summary": "résumé en 2-3 phrases, ton neutre et rassurant",
  "scorecard": {
    "amaigrissement": 1-5,
    "fatigue": 1-5,
    "teint": 1-5,
    "hydratation": 1-5
  },
  "findings": [
    { "indicator": "nom du trait", "observation": "ce que tu observes concrètement sur la photo", "relevance": "à quoi ce type de signe est associé dans la littérature scientifique", "confidence": "faible" | "modérée" | "élevée" }
  ]
}

Le "scorecard" est une échelle d'INTENSITÉ VISUELLE qualitative de 1 à 5 (PAS un score clinique/médical) :
- "amaigrissement" : 1 = joues/tempes pleines, aucun creusement visible ; 5 = creusement très marqué des joues/tempes, mâchoire très définie
- "fatigue" : 1 = pas de cernes/poches visibles, teint reposé ; 5 = cernes/poches très marqués
- "teint" : 1 = teint uniforme et sain à l'œil ; 5 = pâleur, rougeurs ou irrégularités marquées
- "hydratation" : 1 = peau qui semble hydratée/éclatante ; 5 = peau qui semble très sèche/terne
Attribue TOUJOURS les 4 scores, même si le trait n'est pas notable (alors mets 1 ou 2). Sois cohérent : un score élevé doit correspondre à une observation concrète dans "findings" ou "summary".

Règles strictes :
- N'invente RIEN. Si tu ne vois aucun trait notable, retourne un tableau "findings" vide et dis-le dans "summary" (mais donne quand même le "scorecard").
- Ne pose JAMAIS de diagnostic. Utilise "peut être associé à", jamais "vous avez" / "signe de".
- Jamais de chiffre médical (% de graisse, kg, âge) — le "scorecard" est une échelle d'intensité visuelle relative, pas une mesure clinique.
- Sois honnête sur les limites d'une photo unique de visage — baisse la confiance en conséquence plutôt que d'affirmer.
- Si tu détectes une possible asymétrie faciale (alerte AVC), sois factuel et invite à consulter en urgence si le signe est net et nouveau — sans dramatiser à tort.
- Reste bienveillant, factuel, jamais alarmiste, jamais focalisé sur l'apparence/esthétique — l'angle est toujours la santé et le bien-être.`;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(`users/${USER}/faceScans`).orderBy("date", "desc").limit(30).get();
    const scans: FaceScanEntry[] = snap.docs.map(d => d.data() as FaceScanEntry);
    return NextResponse.json({ scans });
  } catch (e) {
    console.error("[face-scan GET]", e);
    return NextResponse.json({ error: "Failed to fetch scans" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  const formData = await req.formData();
  const date      = formData.get("date") as string | null;
  const faceFile  = formData.get("face") as File | null;
  const compareWithPrevious = formData.get("compareWithPrevious") === "true";

  if (!date || !faceFile) {
    return NextResponse.json({ error: "Missing date or face image" }, { status: 400 });
  }
  if (faceFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 500KB after compression)" }, { status: 413 });
  }

  try {
    const db = getAdminFirestore();

    const faceBuffer = Buffer.from(await faceFile.arrayBuffer());
    const faceBase64  = faceBuffer.toString("base64");
    const faceMime    = faceFile.type || "image/jpeg";
    const faceImageUrl = `data:${faceMime};base64,${faceBase64}`;

    // Optionally fetch the most recent previous scan for a comparison prompt
    let previousScan: FaceScanEntry | null = null;
    if (compareWithPrevious) {
      const prevSnap = await db.collection(`users/${USER}/faceScans`)
        .orderBy("date", "desc").limit(1).get();
      if (!prevSnap.empty) previousScan = prevSnap.docs[0].data() as FaceScanEntry;
    }

    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: `Photo du visage :` },
      { type: "image_url", image_url: { url: faceImageUrl } },
    ];

    if (previousScan) {
      userContent.push(
        { type: "text", text: `Photo du visage prise précédemment (le ${previousScan.date}), pour comparaison :` },
        { type: "image_url", image_url: { url: previousScan.faceImageUrl } },
        { type: "text", text: `Compare la nouvelle photo à la précédente, en particulier le volume des joues, le creux des tempes, la définition de la mâchoire, l'état des cernes et le teint. Ajoute un champ "comparisonNote" dans le JSON (string, 1-2 phrases) décrivant toute évolution visible notable, ou indiquant qu'aucune évolution notable n'est visible. Reste qualitatif, sans chiffre.` },
      );
    }

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        reasoning_effort: "none", // qwen3.6-27b defaults to "thinking" mode, which prefixes reasoning text before the JSON and breaks json_object validation
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq face-scan vision error:", err);
      return NextResponse.json({ error: "Vision API error" }, { status: 502 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const rawContent = data.choices?.[0]?.message?.content ?? "{}";
    // Defensive: strip any stray reasoning/prose the model might prepend/append
    // around the JSON object despite reasoning_effort: "none".
    const jsonStart = rawContent.indexOf("{");
    const jsonEnd = rawContent.lastIndexOf("}");
    const content = jsonStart !== -1 && jsonEnd > jsonStart ? rawContent.slice(jsonStart, jsonEnd + 1) : rawContent;
    const parsed = JSON.parse(content) as {
      summary?: string;
      scorecard?: Partial<FaceScanScorecard>;
      findings?: FaceScanFinding[];
      comparisonNote?: string;
    };

    const clamp = (v: unknown): number => {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (!Number.isFinite(n)) return 2;
      return Math.min(5, Math.max(1, Math.round(n)));
    };

    const scorecard: FaceScanScorecard = {
      amaigrissement: clamp(parsed.scorecard?.amaigrissement),
      fatigue:        clamp(parsed.scorecard?.fatigue),
      teint:          clamp(parsed.scorecard?.teint),
      hydratation:    clamp(parsed.scorecard?.hydratation),
    };

    const analysis: FaceScanAnalysis = {
      summary: parsed.summary || "Analyse indisponible.",
      scorecard,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      ...(parsed.comparisonNote ? { comparisonNote: parsed.comparisonNote } : {}),
      disclaimer: DISCLAIMER,
    };

    const id = db.collection(`users/${USER}/faceScans`).doc().id;
    const entry: FaceScanEntry = {
      id, date, faceImageUrl, analysis,
      createdAt: Timestamp.now(),
    };

    await db.collection(`users/${USER}/faceScans`).doc(id).set(entry);

    return NextResponse.json({ scan: entry }, { status: 201 });
  } catch (e) {
    console.error("[face-scan POST]", e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection(`users/${USER}/faceScans`).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[face-scan DELETE]", e);
    return NextResponse.json({ error: "Failed to delete scan" }, { status: 500 });
  }
}
