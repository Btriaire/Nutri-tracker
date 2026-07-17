export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { FaceScanEntry, FaceScanAnalysis, FaceScanFinding } from "@/app/lib/types";

const USER = "owner";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_IMAGE_BYTES = 500 * 1024; // 500KB per image after client-side compression

const DISCLAIMER =
  "Ceci n'est pas un diagnostic médical. Ce sont des observations visuelles générales basées sur des signes " +
  "cliniques documentés dans la littérature médicale — elles peuvent avoir de nombreuses causes bénignes " +
  "(fatigue, lumière, éclairage de la photo) et ne remplacent en aucun cas un examen par un professionnel de " +
  "santé. Consulte un médecin pour toute observation qui te préoccupe ou persiste.";

const SYSTEM_PROMPT = `Tu es un assistant qui décrit des observations visuelles générales sur des photos de visage et d'œil, à des fins d'auto-suivi bien-être — PAS un outil de diagnostic médical.

Analyse les 2 photos fournies (visage, œil) et cherche UNIQUEMENT des signes visuels bien documentés dans la littérature médicale de référence (sémiologie clinique classique) :
- Pâleur conjonctivale (intérieur de la paupière inférieure) — associée à l'anémie
- Ictère scléral (jaunissement du blanc de l'œil) — associé à une hyperbilirubinémie (foie, voies biliaires, hémolyse)
- Xanthélasma (plaques jaunâtres sur les paupières) — associé à une hyperlipidémie
- Arc cornéen / gérontoxon (anneau gris-blanc autour de la cornée) — associé à une hyperlipidémie, surtout si présent avant 45 ans
- Œdème périorbitaire / poches — peut être associé à rétention d'eau, thyroïde, sommeil, allergies
- Asymétrie faciale ou affaissement d'un côté — signe d'alerte AVC (protocole FAST), à signaler avec la plus grande prudence
- Cyanose périorale (bleuissement autour des lèvres) — associée à une oxygénation insuffisante
- Éruption malaire ("masque de loup", rougeur sur joues/nez) — associée au lupus
- Cernes marqués — généralement bénin (fatigue, génétique), faible spécificité clinique
- Amincissement du tiers externe des sourcils — parfois associé à une hypothyroïdie

Retourne UNIQUEMENT un JSON valide (sans markdown) avec :
{
  "summary": "résumé en 2-3 phrases, ton neutre et rassurant",
  "findings": [
    { "indicator": "nom du signe", "observation": "ce que tu observes concrètement sur la photo", "relevance": "à quoi ce type de signe est cliniquement associé dans la littérature", "confidence": "faible" | "modérée" | "élevée" }
  ]
}

Règles strictes :
- N'invente RIEN. Si tu ne vois aucun signe notable, retourne un tableau "findings" vide et dis-le dans "summary".
- Ne pose JAMAIS de diagnostic. Utilise "peut être associé à", jamais "vous avez" / "signe de".
- Si tu détectes une possible asymétrie faciale (alerte AVC), sois factuel et invite à consulter en urgence si le signe est net et nouveau — sans dramatiser à tort.
- Reste bienveillant, factuel, jamais alarmiste.`;

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
  const eyeFile   = formData.get("eye") as File | null;
  const compareWithPrevious = formData.get("compareWithPrevious") === "true";

  if (!date || !faceFile || !eyeFile) {
    return NextResponse.json({ error: "Missing date, face or eye image" }, { status: 400 });
  }
  if (faceFile.size > MAX_IMAGE_BYTES || eyeFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 500KB after compression)" }, { status: 413 });
  }

  try {
    const db = getAdminFirestore();

    const faceBuffer = Buffer.from(await faceFile.arrayBuffer());
    const eyeBuffer   = Buffer.from(await eyeFile.arrayBuffer());
    const faceBase64  = faceBuffer.toString("base64");
    const eyeBase64   = eyeBuffer.toString("base64");
    const faceMime    = faceFile.type || "image/jpeg";
    const eyeMime     = eyeFile.type || "image/jpeg";
    const faceImageUrl = `data:${faceMime};base64,${faceBase64}`;
    const eyeImageUrl  = `data:${eyeMime};base64,${eyeBase64}`;

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
      { type: "text", text: `Photo de l'œil :` },
      { type: "image_url", image_url: { url: eyeImageUrl } },
    ];

    if (previousScan) {
      userContent.push(
        { type: "text", text: `Photo du visage prise précédemment (le ${previousScan.date}), pour comparaison :` },
        { type: "image_url", image_url: { url: previousScan.faceImageUrl } },
        { type: "text", text: `Photo de l'œil prise précédemment (le ${previousScan.date}), pour comparaison :` },
        { type: "image_url", image_url: { url: previousScan.eyeImageUrl } },
        { type: "text", text: `Compare les nouvelles photos aux précédentes et ajoute un champ "comparisonNote" dans le JSON (string, 1-2 phrases) décrivant toute évolution visible notable, ou indiquant qu'aucune évolution notable n'est visible.` },
      );
    }

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: "json_object" },
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
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { summary?: string; findings?: FaceScanFinding[]; comparisonNote?: string };

    const analysis: FaceScanAnalysis = {
      summary: parsed.summary || "Analyse indisponible.",
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      ...(parsed.comparisonNote ? { comparisonNote: parsed.comparisonNote } : {}),
      disclaimer: DISCLAIMER,
    };

    const id = db.collection(`users/${USER}/faceScans`).doc().id;
    const entry: FaceScanEntry = {
      id, date, faceImageUrl, eyeImageUrl, analysis,
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
