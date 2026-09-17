// Constantes et type partages entre ActivityClient.tsx et les composants
// extraits de son formulaire (ActivityFormBody, ActivityHistory) — evite un
// import circulaire (le composant enfant ne peut pas importer depuis le
// fichier qui l'importe).

export const ACTIVITY_OPTIONS = [
  { type: 0,   emoji: "🏅", label: "Activité libre" },
  { type: 1,   emoji: "🏃", label: "Course à pied" },
  { type: 7,   emoji: "🚴", label: "Vélo" },
  { type: 17,  emoji: "🏋️", label: "Musculation" },
  { type: 46,  emoji: "🚶", label: "Marche" },
  { type: 93,  emoji: "🏊", label: "Natation" },
  { type: 82,  emoji: "🧘", label: "Yoga" },
  { type: 9,   emoji: "💪", label: "Aérobic / HIIT" },
  { type: 83,  emoji: "💃", label: "Danse" },
  { type: 45,  emoji: "⚽", label: "Football" },
  { type: 54,  emoji: "🎾", label: "Tennis" },
  { type: 104, emoji: "🥊", label: "Boxe" },
];

export const MET: Record<number, number> = {
  0: 5, 1: 9, 7: 7, 17: 6, 46: 3.5, 93: 8, 82: 3, 9: 8, 83: 5, 45: 7, 54: 6, 104: 9,
};

const MUSCU_TYPES = new Set([17, 60]);
export function isMuscu(type: number) { return MUSCU_TYPES.has(type); }

export interface FormState {
  actType:        number;
  duration:       string;
  customName:     string;
  calories:       string;
  // Musculation-specific
  sets:           string;
  reps:           string;
  weightKg:       string;
  variableWeight: boolean;
  weightPerSet:   string[];
}

export const EMPTY_FORM: FormState = {
  actType:        0,
  duration:       "30",
  customName:     "",
  calories:       "",
  sets:           "3",
  reps:           "10",
  weightKg:       "",
  variableWeight: false,
  weightPerSet:   [],
};
