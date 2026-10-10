// Propositions concrètes pour la semaine : ce qui manque vs l'objectif, avec des quantités.
// Pur et déterministe (pas d'IA) : chaque chiffre vient de la moyenne du rapport et des aliments réellement mangés.

export interface Per100 { calories: number; proteinG: number; fiberG: number }
export interface FoodCandidate { name: string; usualGrams: number; count: number; per100: Per100 }
export interface ProposalInput {
  daysLogged: number;
  avgCalories: number; avgProteinG: number; avgFiberG: number; avgWaterMl: number;
  goals: { dailyCalories: number; proteinGrams: number; fiberGrams: number; waterMl: number };
  foods: FoodCandidate[];
}
export interface Proposal { kind: "ajouter" | "augmenter" | "réduire" | "boire"; text: string }

// Repères d'ordre de grandeur (g pour 100 g), pour quand tes aliments habituels ne couvrent pas le besoin.
export const IDEAS: { name: string; per100: Per100 }[] = [
  { name: "lentilles cuites", per100: { calories: 116, proteinG: 9, fiberG: 8 } },
  { name: "pois chiches cuits", per100: { calories: 164, proteinG: 9, fiberG: 8 } },
  { name: "poulet (blanc, cuit)", per100: { calories: 165, proteinG: 31, fiberG: 0 } },
  { name: "yaourt grec nature", per100: { calories: 97, proteinG: 9, fiberG: 0 } },
  { name: "amandes", per100: { calories: 579, proteinG: 21, fiberG: 12 } },
  { name: "flocons d'avoine", per100: { calories: 372, proteinG: 13, fiberG: 10 } },
];

const round10 = (x: number) => Math.round(x / 10) * 10;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const g1 = (x: number) => Math.round(x).toString().replace(".", ",");

export function buildProposals(p: ProposalInput): Proposal[] {
  if (p.daysLogged < 3) return [{ kind: "ajouter", text: "Pas assez de jours saisis pour proposer des quantités : saisis au moins 3 jours." }];
  const out: Proposal[] = [];
  const regular = p.foods.filter((f) => f.count >= 2);

  // Protéines et fibres : ce qui manque, avec l'aliment le plus dense (le tien d'abord, sinon une idée)
  const need = (label: string, unit: string, avg: number, goal: number, key: "proteinG" | "fiberG", minDensity: number) => {
    if (avg >= goal * 0.85) return;
    const gap = goal - avg;
    const own = regular.filter((f) => f.per100[key] >= minDensity).sort((a, b) => b.per100[key] - a.per100[key])[0];
    const idea = IDEAS.filter((i) => i.per100[key] >= minDensity).sort((a, b) => b.per100[key] - a.per100[key])[0];
    if (own) {
      const g = clamp(round10((gap / own.per100[key]) * 100), 20, 250);
      out.push({ kind: "augmenter", text: `${label} : il te manque ~${g1(gap)} ${unit}/jour. Augmente ${own.name} de ~${g} g/jour (tu en manges ${own.usualGrams} g par portion).` });
    } else if (idea) {
      const g = clamp(round10((gap / idea.per100[key]) * 100), 20, 250);
      out.push({ kind: "ajouter", text: `${label} : il te manque ~${g1(gap)} ${unit}/jour. Ajoute ~${g} g/jour de ${idea.name}.` });
    }
  };
  need("Protéines", "g", p.avgProteinG, p.goals.proteinGrams, "proteinG", 5);
  need("Fibres", "g", p.avgFiberG, p.goals.fiberGrams, "fiberG", 3);

  // Calories : trop ou pas assez
  const ratio = p.avgCalories / Math.max(1, p.goals.dailyCalories);
  if (ratio > 1.1) {
    const big = regular.filter((f) => f.per100.calories > 0).sort((a, b) => (b.per100.calories * b.usualGrams) - (a.per100.calories * a.usualGrams))[0];
    if (big) {
      const to = round10(big.usualGrams * 0.8);
      out.push({ kind: "réduire", text: `Calories : ~${g1(p.avgCalories - p.goals.dailyCalories)} kcal au-dessus de l'objectif. Réduis ${big.name} de ${big.usualGrams} g à ${to} g (≈ ${g1(big.per100.calories * (big.usualGrams - to) / 100)} kcal de moins par portion).` });
    }
  } else if (ratio < 0.85) {
    out.push({ kind: "ajouter", text: `Calories : ~${g1(p.goals.dailyCalories - p.avgCalories)} kcal sous l'objectif. Ajoute une portion d'un aliment protéiné que tu manges déjà, ou une collation.` });
  }

  // Eau
  if (p.avgWaterMl < p.goals.waterMl * 0.8) {
    out.push({ kind: "boire", text: `Eau : ~${g1(p.goals.waterMl - p.avgWaterMl)} ml/jour sous l'objectif. Un verre de plus à chaque repas suffit.` });
  }

  return out.length ? out : [{ kind: "ajouter", text: "Tes apports sont proches de l'objectif cette semaine : rien à corriger." }];
}
