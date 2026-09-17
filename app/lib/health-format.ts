// Helpers cardio/sommeil partages entre HealthClient.tsx et CardiaqueTab.tsx
// (extrait lors de l'eclatement de HealthClient — deux fichiers en avaient
// besoin, mieux vaut un point d'entree unique qu'une duplication qui pourrait
// diverger).

export function hrZone(bpm: number, maxHr: number): { label: string; color: string; desc: string } {
  const pct = bpm / maxHr;
  if (pct < 0.50) return { label: "Repos",        color: "var(--fit-indigo)", desc: "Récupération active" };
  if (pct < 0.60) return { label: "Échauffement", color: "var(--fit-blue)",           desc: "Zone 1 · 50–60%" };
  if (pct < 0.70) return { label: "Aérobie",      color: "var(--fit-green)",  desc: "Zone 2 · 60–70%" };
  if (pct < 0.85) return { label: "Seuil",        color: "var(--fit-yellow)",           desc: "Zone 3 · 70–85%" };
  return                 { label: "Maximal",      color: "var(--fit-red)",    desc: "Zone 4 · >85%" };
}

export function fmtSleep(min: number | null | undefined): string {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
