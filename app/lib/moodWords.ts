// Same constellation as Halcyon-PaLaMa's mood circle (its
// lib/content/moodWords.ts) — kept in sync by hand since the two apps
// don't share a package, but the axes and positions match exactly so an
// entry pushed from either app reads the same way in both. Positions come
// from a sunflower/Vogel spiral (see the Halcyon-PaLaMa file for why —
// a grid produced visible rings, hand-placement left a hollow center).
export interface MoodWord {
  x: number;
  y: number;
  label: string;
}

export const MOOD_WORDS: MoodWord[] = [
  // Agréable + énergique (haut-droit), du plus doux au plus intense
  { x: 0.295, y: -0.031, label: "Content" },
  { x: 0.232, y: -0.321, label: "Épanoui" },
  { x: 0.423, y: -0.192, label: "Vivant" },
  { x: 0.155, y: -0.496, label: "Motivé" },
  { x: 0.417, y: -0.387, label: "Stimulé" },
  { x: 0.596, y: -0.138, label: "Emballé" },
  { x: 0.313, y: -0.57, label: "Joyeux" },
  { x: 0.587, y: -0.358, label: "Fier" },
  { x: 0.13, y: -0.71, label: "Enthousiaste" },
  { x: 0.486, y: -0.576, label: "Radieux" },
  { x: 0.736, y: -0.269, label: "Passionné" },
  { x: 0.301, y: -0.755, label: "Ravi" },
  { x: 0.658, y: -0.523, label: "Excité" },
  { x: 0.857, y: -0.131, label: "Euphorique" },
  { x: 0.487, y: -0.748, label: "Débordant" },
  { x: 0.818, y: -0.418, label: "Extatique" },

  // Désagréable + énergique (haut-gauche), du plus doux au plus intense
  { x: -0.295, y: -0.031, label: "Agacé" },
  { x: -0.232, y: -0.321, label: "Contrarié" },
  { x: -0.423, y: -0.192, label: "Inquiet" },
  { x: -0.155, y: -0.496, label: "Nerveux" },
  { x: -0.417, y: -0.387, label: "Agité" },
  { x: -0.596, y: -0.138, label: "Tendu" },
  { x: -0.313, y: -0.57, label: "Sous pression" },
  { x: -0.587, y: -0.358, label: "Frustré" },
  { x: -0.13, y: -0.71, label: "Anxieux" },
  { x: -0.486, y: -0.576, label: "Bouleversé" },
  { x: -0.736, y: -0.269, label: "Stressé" },
  { x: -0.301, y: -0.755, label: "En colère" },
  { x: -0.658, y: -0.523, label: "Furieux" },
  { x: -0.857, y: -0.131, label: "Débordé" },
  { x: -0.487, y: -0.748, label: "Effrayé" },
  { x: -0.818, y: -0.418, label: "Paniqué" },

  // Désagréable + calme (bas-gauche), du plus doux au plus intense
  { x: -0.295, y: 0.031, label: "Déçu" },
  { x: -0.232, y: 0.321, label: "Morose" },
  { x: -0.423, y: 0.192, label: "Las" },
  { x: -0.155, y: 0.496, label: "Fatigué" },
  { x: -0.417, y: 0.387, label: "Amorphe" },
  { x: -0.596, y: 0.138, label: "Vide" },
  { x: -0.313, y: 0.57, label: "Découragé" },
  { x: -0.587, y: 0.358, label: "Triste" },
  { x: -0.13, y: 0.71, label: "Épuisé" },
  { x: -0.486, y: 0.576, label: "Seul" },
  { x: -0.736, y: 0.269, label: "Mélancolique" },
  { x: -0.301, y: 0.755, label: "Accablé" },
  { x: -0.658, y: 0.523, label: "Abattu" },
  { x: -0.857, y: 0.131, label: "Désespéré" },
  { x: -0.487, y: 0.748, label: "Éteint" },
  { x: -0.818, y: 0.418, label: "Anéanti" },

  // Agréable + calme (bas-droit), du plus doux au plus intense
  { x: 0.295, y: 0.031, label: "Détendu" },
  { x: 0.232, y: 0.321, label: "Tranquille" },
  { x: 0.423, y: 0.192, label: "Léger" },
  { x: 0.155, y: 0.496, label: "Calme" },
  { x: 0.417, y: 0.387, label: "Confiant" },
  { x: 0.596, y: 0.138, label: "Choyé" },
  { x: 0.313, y: 0.57, label: "Reconnaissant" },
  { x: 0.587, y: 0.358, label: "Apaisé" },
  { x: 0.13, y: 0.71, label: "Satisfait" },
  { x: 0.486, y: 0.576, label: "Rassuré" },
  { x: 0.736, y: 0.269, label: "Serein" },
  { x: 0.301, y: 0.755, label: "Harmonieux" },
  { x: 0.658, y: 0.523, label: "Paisible" },
  { x: 0.857, y: 0.131, label: "Béat" },
  { x: 0.487, y: 0.748, label: "Rayonnant" },
  { x: 0.818, y: 0.418, label: "Comblé" },
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
