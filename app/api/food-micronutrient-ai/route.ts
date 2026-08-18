export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";
import {
  getMicronutrientLibraryEntry, saveMicronutrientProfile,
  scaleProfile, type LibraryMicronutrient,
} from "@/app/lib/micronutrient-library";
import type { MicronutrientCode } from "@/app/lib/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MICRONUTRIENT_CODES = Object.keys(MICRONUTRIENT_DB);

const SYSTEM_PROMPT = `Tu es un expert en nutrition francophone, avec une connaissance fine des tables de composition nutritionnelle (type CIQUAL/USDA). Pour l'aliment donné, retourne UNIQUEMENT un objet JSON valide (sans markdown) avec ce champ :
- micronutrients: array   (profil micronutrimentaire de cet aliment POUR 100g)
  Chaque élément : { "code": string, "amount": number, "unit": string }
  "code" DOIT être une valeur EXACTE parmi cette liste (${MICRONUTRIENT_CODES.length} valeurs) : ${MICRONUTRIENT_CODES.join(", ")}

MÉTHODE — passe en revue CHACUN des ${MICRONUTRIENT_CODES.length} codes ci-dessus un par un pour cet aliment précis, comme le ferait une table de composition nutritionnelle complète, et inclus TOUS ceux présents en quantité mesurable (pas seulement les 2-3 plus évidents). Ne te limite pas au nutriment "signature" de l'aliment :
- Un aliment végétal a presque toujours plusieurs minéraux (potassium, magnésium, souvent fer, manganèse) en plus de sa vitamine principale.
- Un fruit riche en vitamine C contient généralement aussi du potassium et du folate.
- Une viande/poisson contient typiquement fer, zinc, phosphore, plusieurs vitamines B, et pour les poissons gras de la vitamine D.
- Un produit laitier contient typiquement calcium, phosphore, vitamine B12, souvent zinc et iode.
- Une céréale complète ou légumineuse contient typiquement magnésium, manganèse, phosphore, folate, thiamine.
Ne signale un micronutriment que s'il est réellement présent en quantité nutritionnellement significative (pas de traces négligeables), mais ne t'arrête pas après avoir trouvé 1 ou 2 nutriments évidents — un aliment courant a très souvent 4 à 8 micronutriments significatifs de cette liste, pas 1 seul.

ALIMENTS RÉGIONAUX / PEU COURANTS (ex : radis noir, topinambour, panais, rutabaga, cerfeuil tubéreux, salsifis) : ne conclus JAMAIS à "aucun micronutriment" simplement parce que le nom t'est moins familier. Raisonne par analogie botanique/nutritionnelle avec la famille de légumes/fruits la plus proche que tu connais bien (ex : le radis noir est une racine crucifère comme le radis rose et le navet — vitamine C, potassium, souvent folate et calcium) et donne une estimation raisonnable plutôt qu'un tableau vide. Un tableau vide ne doit être réservé qu'à des cas réellement dénués de micronutriments (sucre, huile raffinée, sel, eau).

  "amount" doit être calculé POUR 100 GRAMMES de cet aliment (pas pour une portion) — ce profil sera mis en cache et réutilisé pour d'autres quantités, donc précis mais réutilisable.
  "unit" doit être cohérent avec le nutriment (mg ou µg).

Réponds uniquement en JSON. Ne fournis aucune explication hors du JSON.`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name: string; grams: number };
  try {
    body = await req.json() as { name: string; grams: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name  = body.name?.trim();
  const grams = body.grams;
  if (!name || !grams) return NextResponse.json({ error: "name and grams required" }, { status: 400 });

  // 1. Check the shared library cache first — avoids hitting Groq for foods already looked up.
  // A missing/empty/sparse (<3 nutrients) cached profile is treated as a miss and retried:
  // most whole foods genuinely have several trace nutrients, so a thin result is far more
  // likely a past bad/rushed AI answer (or one predating a prompt improvement) than a real
  // "barely anything in this food" — don't let that poison the cache forever. A manually
  // verified profile is always trusted as-is, however sparse, since it's the user's own answer.
  const entry = await getMicronutrientLibraryEntry(name);
  if (entry?.per100g?.length && (entry.verifiedManually || entry.per100g.length >= 3)) {
    return NextResponse.json({ ok: true, micronutrients: scaleProfile(entry.per100g, grams), cached: true });
  }

  // 2. Cache miss — ask Groq for a per-100g profile, cache it, then scale to the requested grams
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // llama-3.3-70b-versatile was deprecated by Groq
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Aliment : ${name}. Liste tous les micronutriments significatifs pour 100g, pas seulement les plus évidents.` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq food-micronutrient-ai error:", err);
      return NextResponse.json({ error: "Groq API error" }, { status: 502 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { micronutrients?: LibraryMicronutrient[] };

    // Filter out any hallucinated micronutrient codes not in our known list
    const validCodes = new Set<string>(MICRONUTRIENT_CODES);
    const per100g = (parsed.micronutrients || []).filter(
      (m): m is LibraryMicronutrient =>
        !!m.code && validCodes.has(m.code as MicronutrientCode) && typeof m.amount === "number" && m.amount > 0
    );

    // Cache non-empty profiles for next time. Empty results aren't cached — they read back
    // as a miss anyway now, so caching them would just be a stale doc no one reads.
    if (per100g.length > 0) await saveMicronutrientProfile(name, per100g);

    return NextResponse.json({ ok: true, micronutrients: scaleProfile(per100g, grams), cached: false });
  } catch (e) {
    console.error("Food micronutrient AI lookup error:", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}

// GET /api/food-micronutrient-ai?name=... — raw per-100g profile for the manual editor
// (unscaled, unlike POST which scales to a specific serving size).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const entry = await getMicronutrientLibraryEntry(name);
  return NextResponse.json({
    per100g: entry?.per100g ?? [],
    verifiedManually: entry?.verifiedManually ?? false,
  });
}

// PUT /api/food-micronutrient-ai — manually set/correct a food's per-100g profile.
// Marked verifiedManually so it's never re-guessed or overwritten by the AI lookup above.
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name: string; micronutrients: LibraryMicronutrient[] };
  try {
    body = await req.json() as { name: string; micronutrients: LibraryMicronutrient[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const validCodes = new Set<string>(MICRONUTRIENT_CODES);
  const per100g = (Array.isArray(body.micronutrients) ? body.micronutrients : []).filter(
    (m): m is LibraryMicronutrient =>
      !!m?.code && validCodes.has(m.code as MicronutrientCode) && typeof m.amount === "number" && m.amount > 0
  );

  await saveMicronutrientProfile(name, per100g, true);
  return NextResponse.json({ ok: true, per100g });
}
