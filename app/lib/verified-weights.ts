// Poids moyens vérifiés pour des aliments courants dont la portion "par défaut"
// renvoyée par les APIs externes (souvent 100g générique, ou une valeur de
// packaging peu représentative) ne correspond pas à un poids réaliste tel
// qu'on le consomme (ex. "1 banane" = 100g par défaut, alors qu'une banane
// pesée fait ~120g). Volontairement une petite liste ciblée, à étoffer au fil
// de l'eau — pas une tentative de couvrir tous les aliments.
//
// unitLabel sert a proposer un compteur "par unité" (2 œufs, 3 bananes...) une
// fois le poids vérifié — le calcul nutritionnel passe TOUJOURS par grams
// (quantité × grams, jamais un multiplicateur "à vue") : voir effectiveGrams()
// dans FoodSearchModal.tsx, qui fait déjà customQty * selectedUnit.grams.

interface VerifiedWeightEntry {
  match:     string[]; // tous ces mots doivent apparaitre dans le nom normalise (voir normalize() dans food-api.ts)
  grams:     number;   // poids d'1 unite, en grammes — c'est CA qui alimente le calcul nutritionnel
  label:     string;   // libelle complet affiche au premier choix, ex. "1 oeuf (55g)"
  unitLabel: string;   // libelle court reutilise pour le compteur d'unites, ex. "1 oeuf"
}

const VERIFIED_WEIGHTS: VerifiedWeightEntry[] = [
  { match: ["banane"],              grams: 120, label: "1 banane (120g)",              unitLabel: "1 banane" },
  { match: ["pomme"],               grams: 180, label: "1 pomme (180g)",               unitLabel: "1 pomme" },
  { match: ["oeuf"],                grams: 55,  label: "1 oeuf (55g)",                 unitLabel: "1 oeuf" },
  { match: ["avocat"],              grams: 170, label: "1 avocat (170g)",              unitLabel: "1 avocat" },
  { match: ["orange"],              grams: 200, label: "1 orange (200g)",              unitLabel: "1 orange" },
  { match: ["tomate"],              grams: 120, label: "1 tomate (120g)",              unitLabel: "1 tomate" },
  { match: ["yaourt", "nature"],    grams: 125, label: "1 yaourt nature (125g)",        unitLabel: "1 yaourt" },
  { match: ["tranche", "pain"],     grams: 30,  label: "1 tranche de pain (30g)",       unitLabel: "1 tranche" },
  { match: ["kiwi"],                grams: 75,  label: "1 kiwi (75g)",                 unitLabel: "1 kiwi" },
  { match: ["pomme", "terre"],      grams: 150, label: "1 pomme de terre (150g)",       unitLabel: "1 pomme de terre" },
  { match: ["poivron"],             grams: 150, label: "1 poivron (150g)",             unitLabel: "1 poivron" },
  { match: ["carotte"],             grams: 80,  label: "1 carotte (80g)",              unitLabel: "1 carotte" },
  { match: ["banane", "plantain"],  grams: 180, label: "1 banane plantain (180g)",      unitLabel: "1 banane plantain" },
];

/** Poids vérifié pour un nom d'aliment déjà normalisé (normalize() de food-api.ts) —
 *  null si aucun match. Réservé aux noms courts/génériques (voir food-api.ts) pour
 *  éviter de matcher un produit de marque contenant accidentellement le même mot. */
export function lookupVerifiedWeight(normalizedName: string): { grams: number; label: string; unitLabel: string } | null {
  for (const entry of VERIFIED_WEIGHTS) {
    if (entry.match.every((m) => normalizedName.includes(m))) {
      return { grams: entry.grams, label: entry.label, unitLabel: entry.unitLabel };
    }
  }
  return null;
}
