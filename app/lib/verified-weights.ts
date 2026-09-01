// Poids moyens vérifiés pour des aliments courants dont la portion "par défaut"
// renvoyée par les APIs externes (souvent 100g générique, ou une valeur de
// packaging peu représentative) ne correspond pas à un poids réaliste tel
// qu'on le consomme (ex. "1 banane" = 100g par défaut, alors qu'une banane
// pesée fait ~120g). Volontairement une petite liste ciblée, à étoffer au fil
// de l'eau — pas une tentative de couvrir tous les aliments.

interface VerifiedWeightEntry {
  match: string[]; // tous ces mots doivent apparaitre dans le nom normalise (voir normalize() dans food-api.ts)
  grams: number;
  label: string;
}

const VERIFIED_WEIGHTS: VerifiedWeightEntry[] = [
  { match: ["banane"],              grams: 120, label: "1 banane (120g)" },
  { match: ["pomme"],               grams: 180, label: "1 pomme (180g)" },
  { match: ["oeuf"],                grams: 55,  label: "1 oeuf (55g)" },
  { match: ["avocat"],              grams: 170, label: "1 avocat (170g)" },
  { match: ["orange"],              grams: 200, label: "1 orange (200g)" },
  { match: ["tomate"],              grams: 120, label: "1 tomate (120g)" },
  { match: ["yaourt", "nature"],    grams: 125, label: "1 yaourt nature (125g)" },
  { match: ["tranche", "pain"],     grams: 30,  label: "1 tranche de pain (30g)" },
  { match: ["kiwi"],                grams: 75,  label: "1 kiwi (75g)" },
  { match: ["pomme", "terre"],      grams: 150, label: "1 pomme de terre (150g)" },
  { match: ["poivron"],             grams: 150, label: "1 poivron (150g)" },
  { match: ["carotte"],             grams: 80,  label: "1 carotte (80g)" },
  { match: ["banane", "plantain"],  grams: 180, label: "1 banane plantain (180g)" },
];

/** Poids vérifié pour un nom d'aliment déjà normalisé (normalize() de food-api.ts) —
 *  null si aucun match. Réservé aux noms courts/génériques (voir food-api.ts) pour
 *  éviter de matcher un produit de marque contenant accidentellement le même mot. */
export function lookupVerifiedWeight(normalizedName: string): { grams: number; label: string } | null {
  for (const entry of VERIFIED_WEIGHTS) {
    if (entry.match.every((m) => normalizedName.includes(m))) {
      return { grams: entry.grams, label: entry.label };
    }
  }
  return null;
}
