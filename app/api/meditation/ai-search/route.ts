import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";

// Validate a YouTube video ID via oEmbed (no API key needed)
async function isVideoValid(videoId: string): Promise<boolean> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok; // 200 = exists, 401/404 = dead
  } catch {
    return false;
  }
}

// POST { theme: string }
// Returns: { tracks: { videoId, title, emoji }[] }
export async function POST(req: NextRequest) {
  let body: { theme?: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const theme = (body.theme ?? "").trim();
  if (!theme) return NextResponse.json({ error: "Missing theme" }, { status: 400 });
  if (!GROQ_KEY) return NextResponse.json({ error: "Groq not configured" }, { status: 500 });

  // Ask Groq to suggest YouTube video IDs for meditation/ambient content matching the theme
  const prompt = `Tu es un expert en méditation et bien-être. L'utilisateur cherche une musique ambiante ou guidée pour : "${theme}".

Propose exactement 6 vidéos YouTube de méditation/ambiance sonore qui correspondent parfaitement à ce thème.
Privilégie les chaînes connues : Meditative Mind, Jason Stephenson, Yellow Brick Cinema, Greenred Productions, PowerThoughts Meditation Club, Solfeggio Frequencies, Nu Meditation Music, Relaxing White Noise.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après :
[
  { "videoId": "XXXXXXXXXXX", "title": "titre court descriptif", "emoji": "emoji thématique" },
  ...
]

Règles :
- videoId : exactement 11 caractères alphanumériques
- title : 3-6 mots descriptifs en français
- emoji : 1 seul emoji symbolisant l'ambiance
- Varie les durées (courts 30min, longs 3-8h)
- Pour le thème donné, pense aux sons et ambiances qui l'accompagnent vraiment`;

  let candidates: { videoId: string; title: string; emoji: string }[] = [];

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!groqRes.ok) {
      const txt = await groqRes.text();
      console.error("Groq error:", groqRes.status, txt);
      return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
    }

    const groqJson = await groqRes.json() as { choices: { message: { content: string } }[] };
    const raw = groqJson.choices[0]?.message?.content ?? "";

    // Extract JSON array from response (Groq sometimes adds prose)
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "AI parse error" }, { status: 502 });

    candidates = JSON.parse(match[0]) as typeof candidates;
  } catch (e) {
    console.error("Groq fetch error:", e);
    return NextResponse.json({ error: "AI fetch error" }, { status: 502 });
  }

  // Validate up to 6 candidates concurrently, return first 3 valid
  const validationResults = await Promise.all(
    candidates.slice(0, 6).map(async (c) => ({
      ...c,
      valid: /^[a-zA-Z0-9_-]{11}$/.test(c.videoId) && await isVideoValid(c.videoId),
    }))
  );

  const tracks = validationResults
    .filter(r => r.valid)
    .slice(0, 3)
    .map(({ valid: _v, ...rest }) => rest);

  return NextResponse.json({ tracks });
}
