// Same constellation as Halcyon-PaLaMa's mood circle (its
// lib/content/moodWords.ts) — kept in sync by hand since the two apps
// don't share a package, but the axes and positions match exactly so an
// entry pushed from either app reads the same way in both.
export interface MoodWord {
  x: number;
  y: number;
  label: string;
}

export const MOOD_WORDS: MoodWord[] = [
  // Agréable + énergique (haut-droit)
  { x: 0.35, y: -0.25, label: "Content" },
  { x: 0.7, y: -0.35, label: "Motivé" },
  { x: 0.55, y: -0.5, label: "Joyeux" },
  { x: 0.6, y: -0.65, label: "Fier" },
  { x: 0.45, y: -0.75, label: "Enthousiaste" },
  { x: 0.8, y: -0.55, label: "Ravi" },
  { x: 0.35, y: -0.85, label: "Excité" },
  { x: 0.47, y: -0.8, label: "Euphorique" },

  // Désagréable + énergique (haut-gauche)
  { x: -0.35, y: -0.25, label: "Agacé" },
  { x: -0.7, y: -0.35, label: "Tendu" },
  { x: -0.55, y: -0.45, label: "Nerveux" },
  { x: -0.6, y: -0.6, label: "Frustré" },
  { x: -0.4, y: -0.7, label: "Anxieux" },
  { x: -0.8, y: -0.5, label: "En colère" },
  { x: -0.35, y: -0.85, label: "Stressé" },
  { x: -0.47, y: -0.8, label: "Paniqué" },

  // Désagréable + calme (bas-gauche)
  { x: -0.35, y: 0.25, label: "Déçu" },
  { x: -0.7, y: 0.35, label: "Fatigué" },
  { x: -0.55, y: 0.45, label: "Las" },
  { x: -0.6, y: 0.6, label: "Découragé" },
  { x: -0.4, y: 0.7, label: "Triste" },
  { x: -0.8, y: 0.5, label: "Seul" },
  { x: -0.35, y: 0.85, label: "Mélancolique" },
  { x: -0.47, y: 0.8, label: "Abattu" },

  // Agréable + calme (bas-droit)
  { x: 0.35, y: 0.25, label: "Détendu" },
  { x: 0.7, y: 0.35, label: "Reconnaissant" },
  { x: 0.55, y: 0.45, label: "Calme" },
  { x: 0.6, y: 0.6, label: "Apaisé" },
  { x: 0.4, y: 0.7, label: "Satisfait" },
  { x: 0.8, y: 0.5, label: "Serein" },
  { x: 0.35, y: 0.85, label: "Paisible" },
  { x: 0.47, y: 0.8, label: "Comblé" },
];

export const MOOD_CENTER_LABEL = "Normal";
export const MOOD_CENTER_THRESHOLD = 0.12;

export function nearestMoodWord(x: number, y: number): MoodWord | null {
  if (Math.hypot(x, y) < MOOD_CENTER_THRESHOLD) return null;
  let closest = MOOD_WORDS[0];
  let smallestDistance = Infinity;
  for (const word of MOOD_WORDS) {
    const d = Math.hypot(word.x - x, word.y - y);
    if (d < smallestDistance) {
      smallestDistance = d;
      closest = word;
    }
  }
  return closest;
}

export function moodLabelFromPosition(x: number, y: number): string {
  return nearestMoodWord(x, y)?.label ?? MOOD_CENTER_LABEL;
}
