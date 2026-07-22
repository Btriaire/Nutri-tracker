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

// Short reference keys the model must pick from (never invent a source) — full
// citations are shown to the user in FaceScanClient's Sources panel.
const REFERENCE_KEYS = [
  "Rohrich2007",       // fat compartments of the face — amaigrissement/creusement
  "Sheth1997",         // conjunctival pallor vs anemia
  "Christoffersen2011", // xanthelasma/arcus corneae vs cardiovascular risk
  "Axelsson2010",      // sleep deprivation and perceived facial fatigue signs (BMJ "Beauty sleep")
  "BatesGuide",        // general clinical semiology — pallor, jaundice, cyanosis, malar rash, eyebrow thinning
  "ASA_FAST",          // facial asymmetry / stroke warning sign
] as const;

const SYSTEM_PROMPT = `Assistant d'auto-suivi bien-être (PAS un diagnostic médical) à partir d'1 photo de visage. Analyse détaillée et systématique, chaque observation ancrée dans une référence scientifique précise.

Passe en revue CHACUN de ces traits, pas seulement les plus évidents :
1. Amaigrissement (réf. Rohrich2007) : creusement des joues (boule de Bichat), fonte temporale, définition mâchoire/pommettes, réduction double menton, sillons nasogéniens. Jamais de % de graisse ni de poids — que du qualitatif et comparatif.
2. Fatigue (réf. Axelsson2010) : cernes, poches périorbitaires, teint terne/grisâtre, léger ptosis (surtout si asymétrique/nouveau), affaissement des coins de bouche.
3. Teint/santé (réf. BatesGuide sauf mention) : pâleur cutanée (Sheth1997 si zone périoculaire), ictère peau/yeux, xanthélasma/arc cornéen (Christoffersen2011), sécheresse/rougeurs diffuses, cyanose péribuccale, éruption malaire, sourcils clairsemés (tiers externe).
4. Asymétrie faciale (réf. ASA_FAST) : à signaler factuellement et avec prudence si net et nouveau, sans dramatiser à tort si léger/habituel.
5. Comparaison (si photo précédente fournie) : LE signal le plus fiable — un visage isolé varie trop entre individus, mais l'évolution du MÊME visage (volume joues/tempes, mâchoire, cernes, teint) est un vrai signal de changement dans le temps.

Sois exhaustif : un visage a presque toujours plusieurs observations pertinentes (souvent 3 à 6), pas juste 1. Pour chaque "finding", cite la référence dont l'observation se rapproche le plus, choisie EXACTEMENT parmi : ${REFERENCE_KEYS.join(", ")}. N'invente jamais d'autre référence.

JSON uniquement, sans markdown :
{"summary":"3-4 phrases détaillées, ton neutre","scorecard":{"amaigrissement":1-5,"fatigue":1-5,"teint":1-5,"hydratation":1-5},"findings":[{"indicator":"","observation":"description précise et concrète de ce qui est visible","relevance":"lien avec la littérature scientifique","confidence":"faible"|"modérée"|"élevée","source":"une des clés ci-dessus"}]}

Scorecard = intensité VISUELLE 1-5 (pas clinique) : amaigrissement 1=plein/5=très creusé ; fatigue 1=reposé/5=cernes marqués ; teint 1=sain/5=irrégulier ; hydratation 1=éclatant/5=très sec. Toujours les 4, cohérents avec findings/summary.

Règles : n'invente rien (findings vide si vraiment rien à signaler) ; jamais de diagnostic ("peut être associé à", jamais "vous avez") ; jamais de chiffre médical ; confiance basse si signe pas clairement visible sur 1 seule photo ; bienveillant, factuel, jamais alarmiste, angle santé jamais esthétique.`;

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
        max_tokens: 1400, // free tier TPM cap (8000) — balanced against 2 compressed images + prompt size for richer findings
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

    // Drop any hallucinated reference key the model might invent
    const validRefs = new Set<string>(REFERENCE_KEYS);
    const findings = (Array.isArray(parsed.findings) ? parsed.findings : []).map(f => ({
      ...f,
      ...(f.source && validRefs.has(f.source) ? { source: f.source } : {}),
    }));

    const analysis: FaceScanAnalysis = {
      summary: parsed.summary || "Analyse indisponible.",
      scorecard,
      findings,
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
