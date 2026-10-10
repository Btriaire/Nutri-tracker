// Podcasts NotebookLM : fichiers .m4a generes et conserves sur le VPS (vps-manager, /opt/notebooklm-nutri/output).
// L'appli ne fait que relayer : si le VPS ne repond pas, on le dit clairement au lieu de laisser une liste vide.

// Route publique et protegee du VPS (nginx, 443) : seules lancer / etat / telecharger y passent, avec la cle.
const PODCAST_URL = process.env.VPS_PODCAST_URL || "https://46.202.131.240.nip.io/podcast-api";
const PODCAST_KEY = process.env.VPS_PODCAST_KEY || "";

export type PodcastFile = { name: string; mtime: string; sizeKb: number };
export type PodcastStatus = { success: boolean; running: boolean; files: PodcastFile[]; error?: string };

const KINDS: Record<string, string> = {
  semaine: "Semaine",
  mois: "Mois",
  trimestre: "Trimestre",
  long: "Bilan complet",
  weekly: "Weekly Complet",
  total: "Depuis le début",
  all: "Depuis le début",
  debut: "Depuis le début",
};

/** "nutri-semaine-2026-09-26.m4a" -> { kind: "Semaine", date: "2026-09-26", long: false } */
export function podcastInfo(name: string): { kind: string; date: string | null; long: boolean } {
  const m = /^nutri-(?:([a-z]+)-)?(\d{4}-\d{2}-\d{2})/.exec(name);
  if (!m) return { kind: "Podcast", date: null, long: false };
  const raw = m[1];
  if (!raw) return { kind: "Podcast", date: m[2], long: false };   // anciens fichiers sans type : nutri-2026-08-25.m4a
  return { kind: KINDS[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1), date: m[2], long: raw === "long" || raw === "weekly" };
}

/** Appel au VPS avec delai maximal sur la reponse (les en-tetes), pas sur la lecture du corps (audio). */
export async function fetchVps(path: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const rel = path.replace("/api/notebooklm-nutri", "");   // /run, /status, /download/x.m4a
    const headers = new Headers(init.headers);
    headers.set("X-Podcast-Key", PODCAST_KEY);
    return await fetch(`${PODCAST_URL}${rel}`, { ...init, headers, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export const VPS_DOWN_MESSAGE = "Le serveur des podcasts (VPS) ne répond pas";
