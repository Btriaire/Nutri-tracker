export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";
import { getCachedMicronutrientProfile, saveMicronutrientProfile, scaleProfile, type LibraryMicronutrient } from "@/app/lib/micronutrient-library";
import type { MicronutrientCode } from "@/app/lib/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MICRONUTRIENT_CODES = Object.keys(MICRONUTRIENT_DB);

const SYSTEM_PROMPT = `Tu es un expert en nutrition francophone. Pour l'aliment donné, retourne UNIQUEMENT un objet JSON valide (sans markdown) avec ce champ :
- micronutrients: array   (profil micronutrimentaire RÉEL de cet aliment POUR 100g, à partir de tes connaissances nutritionnelles)
  Chaque élément : { "code": string, "amount": number, "unit": string }
  "code" DOIT être une valeur EXACTE parmi cette liste : ${MICRONUTRIENT_CODES.join(", ")}
  N'invente pas de code hors de cette liste. Inclus tous les micronutriments de la liste réellement présents en quantité significative dans cet aliment pour 100g (par exemple une orange contient de la vitamine C, du potassium, du folate ; un poivron contient beaucoup de vitamine C ; un poisson gras contient de la vitamine D).
  "amount" doit être calculé POUR 100 GRAMMES de cet aliment (pas pour une portion) — ce profil sera mis en cache et réutilisé pour d'autres quantités.
  "unit" doit être cohérent avec le nutriment (mg ou µg).
  Si l'aliment n'a vraiment aucun micronutriment notable de la liste, retourne un tableau vide [].

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

  // 1. Check the shared library cache first — avoids hitting Groq for foods already looked up
  const cached = await getCachedMicronutrientProfile(name);
  if (cached) {
    return NextResponse.json({ ok: true, micronutrients: scaleProfile(cached, grams), cached: true });
  }

  // 2. Cache miss — ask Groq for a per-100g profile, cache it, then scale to the requested grams
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Aliment : ${name}` },
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

    // Cache for next time (even an empty profile is worth caching — avoids re-asking for foods with no notable micronutrients)
    await saveMicronutrientProfile(name, per100g);

    return NextResponse.json({ ok: true, micronutrients: scaleProfile(per100g, grams), cached: false });
  } catch (e) {
    console.error("Food micronutrient AI lookup error:", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
