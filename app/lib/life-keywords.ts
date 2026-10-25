// Changements de vie / comportement : analyse locale (sans IA) + file d'attente hors ligne.
// Sert de filet de securite : une note doit toujours pouvoir s'enregistrer et afficher des mots-cles,
// meme si l'IA ou le reseau ne repondent pas.

const STOP = new Set([
  "dans", "avec", "pour", "mais", "plus", "moins", "très", "tres", "cette", "cela", "ceci", "ainsi", "alors",
  "aussi", "comme", "depuis", "entre", "être", "avoir", "fait", "faire", "suis", "sont", "était", "etait", "j'ai",
  "mon", "mes", "ses", "nous", "vous", "leur", "leurs", "that", "elle", "elles", "chez", "sans", "sous", "vers",
  "tout", "tous", "toute", "toutes", "quand", "parce", "puis", "donc", "même", "meme", "encore", "maintenant",
  "mis", "mise", "peu", "bien", "pas", "une", "des", "les", "est", "qui", "que", "quoi", "dont", "jour", "jours",
]);

const PERSISTENT = /\b(depuis|désormais|desormais|dorénavant|dorenavant|nouveau|nouvelle|toujours|chaque|tous les|toutes les|régulièrement|regulierement|à partir de|a partir de|maintenant)\b/i;

export interface LocalLifeAnalysis { keywords: string[]; kind: "vie" | "comportement"; persistent: boolean; summary: string }

export function extractKeywords(text: string, max = 5): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^a-zàâäçéèêëîïôöùûüœ'-]+/i)) {
    const w = raw.replace(/^['-]+|['-]+$/g, "");
    if (w.length < 4 || STOP.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, max).map(([w]) => w);
}

export function localLifeAnalysis(text: string): LocalLifeAnalysis {
  const clean = text.trim();
  return {
    keywords: extractKeywords(clean),
    kind: /\b(travail|déménag|demenag|famille|bébé|bebe|deuil|séparation|separation|emploi|école|ecole)\b/i.test(clean) ? "vie" : "comportement",
    persistent: PERSISTENT.test(clean),
    summary: clean.length > 80 ? `${clean.slice(0, 77)}...` : clean,
  };
}

// ─── File d'attente hors ligne (localStorage) ─────────────────────────────────

const QUEUE_KEY = "nt-life-queue";
export interface QueuedLifeNote { text: string; date: string }

function readQueue(): QueuedLifeNote[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedLifeNote[]; } catch { return []; }
}

export function queueLifeNote(item: QueuedLifeNote): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify([...readQueue(), item])); } catch { /* stockage indisponible */ }
}

/** Renvoie les notes en attente ; garde celles qui echouent. Retourne le nombre envoye. */
export async function flushLifeQueue(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;
  const left: QueuedLifeNote[] = [];
  let sent = 0;
  for (const item of queue) {
    try {
      const res = await fetch("/api/life-notes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item),
      });
      if (res.ok) sent++; else left.push(item);
    } catch { left.push(item); }
  }
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(left)); } catch { /* ignore */ }
  return sent;
}
