import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY    = process.env.GROQ_API_KEY ?? "";
const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY ?? "";

// ── Curated fallback pool (validated IDs) ────────────────────────────────────
// Used when YouTube API key is not configured
const CURATED_POOL: { videoId: string; title: string; emoji: string; tags: string[] }[] = [
  { videoId: "77ZozI0rw7w", title: "Bols tibétains 3h",       emoji: "🔔", tags: ["bol","tibétain","stress","anxiété","guérison"] },
  { videoId: "I0GnHkFgSIQ", title: "432 Hz Miracle Tone",     emoji: "✨", tags: ["432hz","fréquence","guérison","chakra"] },
  { videoId: "puX7S3cOlKE", title: "Bols cristal 8h",         emoji: "💎", tags: ["cristal","bol","sommeil","profond"] },
  { videoId: "q76bMs-NwRk", title: "Pluie douce 3h",          emoji: "🌧", tags: ["pluie","nature","sommeil","stress","focus"] },
  { videoId: "nMfPqeZjc2c", title: "Vagues océan 8h",         emoji: "🌊", tags: ["ocean","vague","nature","relaxation","sommeil"] },
  { videoId: "xNN7iTA57jM", title: "Forêt & oiseaux",         emoji: "🌲", tags: ["forêt","nature","oiseau","calme","pleine conscience"] },
  { videoId: "jfKfPfyJRdk", title: "Lofi hip hop 24/7",       emoji: "🎵", tags: ["lofi","focus","travail","énergie","étude"] },
  { videoId: "DWcJFNfaw9c", title: "Ondes Thêta 4Hz 8h",      emoji: "🧠", tags: ["theta","binaural","sommeil","profond","rêve"] },
  { videoId: "5qap5aO4i9A", title: "Ambient spatial lofi",    emoji: "🌌", tags: ["ambient","espace","focus","créativité"] },
  { videoId: "1ZYbU82GVz4", title: "528 Hz DNA Repair",       emoji: "💚", tags: ["528hz","guérison","chakra","réparation","énergie"] },
  { videoId: "lCOF9LN_Zxs", title: "396 Hz Libère la peur",   emoji: "🌈", tags: ["396hz","chakra","racine","anxiété","libération"] },
  { videoId: "iRoaEbCZiHE", title: "963 Hz Glande pinéale",   emoji: "🔮", tags: ["963hz","glande","pinéale","éveil","spirituel"] },
  { videoId: "O4I7p4mSfcE", title: "Pleine lune méditation",  emoji: "🌕", tags: ["pleine lune","lune","intuition","féminin"] },
  { videoId: "1w3GqMFhPm0", title: "Chakra Heart Green",      emoji: "💚", tags: ["chakra","cœur","amour","guérison","anahata"] },
  { videoId: "ot3p2kGdJAM", title: "Forêt bambou Japon",      emoji: "🎋", tags: ["japon","zen","bambou","nature","sérénité"] },
  { videoId: "YyBkAsfcXFg", title: "Pluie sur toit 10h",      emoji: "☔", tags: ["pluie","nuit","sommeil","cocon","confort"] },
];

// ── YouTube Data API search ───────────────────────────────────────────────────
async function searchYouTube(query: string): Promise<{ videoId: string; title: string }[]> {
  const params = new URLSearchParams({
    part:        "snippet",
    q:           query,
    type:        "video",
    videoCategoryId: "10", // Music
    maxResults:  "6",
    key:         YOUTUBE_KEY,
    relevanceLanguage: "fr",
    safeSearch:  "strict",
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);

  const json = await res.json() as {
    items?: { id: { videoId: string }; snippet: { title: string } }[]
  };

  return (json.items ?? []).map(item => ({
    videoId: item.id.videoId,
    title:   item.snippet.title,
  }));
}

// ── Groq: generate search query ───────────────────────────────────────────────
async function groqSearchQuery(theme: string): Promise<string> {
  const prompt = `Generate ONE optimal YouTube search query in English for meditation/ambient music related to: "${theme}".

Requirements:
- Include channel hints like: "Meditative Mind" OR "Yellow Brick Cinema" OR "Greenred Productions" OR "Jason Stephenson"
- Target long videos (1h+)
- Focus on ambient/meditation/binaural content
- Return ONLY the search query string, nothing else

Example output: meditation 432hz healing frequency Meditative Mind`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b", // llama-3.3-70b-versatile was deprecated by Groq
      reasoning_effort: "low",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 150,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return `${theme} meditation ambient`;
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content?.trim() ?? `${theme} meditation ambient`;
}

// ── Groq: pick from curated pool ─────────────────────────────────────────────
async function groqPickFromPool(theme: string): Promise<{ videoId: string; title: string; emoji: string }[]> {
  const poolJson = JSON.stringify(
    CURATED_POOL.map((v, i) => ({ i, title: v.title, emoji: v.emoji, tags: v.tags }))
  );

  const prompt = `The user wants meditation music for the theme: "${theme}".

Available tracks (with index):
${poolJson}

Choose the 3 best matches for this theme. Return ONLY a JSON array of indices, e.g.: [2, 5, 11]`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b", // llama-3.3-70b-versatile was deprecated by Groq
      reasoning_effort: "low",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 120,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return CURATED_POOL.slice(0, 3);

  const json = await res.json() as { choices: { message: { content: string } }[] };
  const raw = json.choices[0]?.message?.content ?? "";
  const match = raw.match(/\[[\d,\s]+\]/);
  if (!match) return CURATED_POOL.slice(0, 3);

  const indices = JSON.parse(match[0]) as number[];
  return indices
    .filter(i => i >= 0 && i < CURATED_POOL.length)
    .slice(0, 3)
    .map(i => ({ videoId: CURATED_POOL[i].videoId, title: CURATED_POOL[i].title, emoji: CURATED_POOL[i].emoji }));
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { theme?: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const theme = (body.theme ?? "").trim();
  if (!theme) return NextResponse.json({ error: "Missing theme" }, { status: 400 });

  // Path 1: YouTube API available → real search + Groq-generated query
  if (YOUTUBE_KEY) {
    try {
      const query = GROQ_KEY
        ? await groqSearchQuery(theme)
        : `${theme} meditation ambient 1 hour`;

      const ytResults = await searchYouTube(query);

      // Map to emoji based on theme keywords
      const emojiMap: Record<string, string> = {
        stress: "😮‍💨", sleep: "🌙", sommeil: "🌙", energy: "⚡", énergie: "⚡",
        focus: "🎯", chakra: "🌈", heal: "💚", guérison: "💚", anxiety: "🌊",
        anxiété: "🌊", hz: "✨", moon: "🌕", lune: "🌕", nature: "🌿",
        rain: "🌧", ocean: "🌊", forest: "🌲", binaural: "🧠",
      };
      const themeEmoji = Object.entries(emojiMap).find(([k]) =>
        theme.toLowerCase().includes(k)
      )?.[1] ?? "☸️";

      const tracks = ytResults.slice(0, 3).map(r => ({
        videoId: r.videoId,
        title:   r.title.length > 45 ? r.title.slice(0, 42) + "…" : r.title,
        emoji:   themeEmoji,
      }));

      return NextResponse.json({ tracks, source: "youtube" });
    } catch (e) {
      console.error("YouTube search error:", e);
      // Fall through to curated pool
    }
  }

  // Path 2: No YouTube API → Groq picks from curated pool
  if (GROQ_KEY) {
    try {
      const tracks = await groqPickFromPool(theme);
      return NextResponse.json({ tracks, source: "curated" });
    } catch (e) {
      console.error("Groq pool error:", e);
    }
  }

  // Path 3: No keys at all → tag-based match from curated pool
  const lower = theme.toLowerCase();
  const matches = CURATED_POOL
    .map(v => ({
      ...v,
      score: v.tags.filter(t => lower.includes(t) || t.includes(lower)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return NextResponse.json({
    tracks: matches.map(({ videoId, title, emoji }) => ({ videoId, title, emoji })),
    source: "curated",
  });
}
