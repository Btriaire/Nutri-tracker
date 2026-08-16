import type { MicronutrientCode, MicronutrientInfo } from "./types";

export const MICRONUTRIENT_DB: Record<MicronutrientCode, MicronutrientInfo> = {
  magnesium: {
    code: "magnesium",
    label: "Magnésium",
    symbol: "Mg",
    unit: "mg",
    recommendedDailyIntake: 400,
    color: "#10b981", // émeraude
  },
  zinc: {
    code: "zinc",
    label: "Zinc",
    symbol: "Zn",
    unit: "mg",
    recommendedDailyIntake: 11,
    color: "#f59e0b", // ambre
  },
  vitamin_d: {
    code: "vitamin_d",
    label: "Vitamine D3",
    symbol: "D3",
    // Tous les apports (aliments comme compléments) sont enregistrés en µg dans cette
    // appli — 600 IU (l'AJR usuel affiché sur les emballages) équivaut à 15µg, jamais
    // "600" en unité IU : sinon le % AJR se retrouve divisé par ~40 par rapport à la
    // réalité (un apport de 15µg, soit 100% de l'AJR, ne montrerait plus que 2.5%).
    unit: "µg",
    recommendedDailyIntake: 15,
    color: "#fbbf24", // jaune
  },
  chromium: {
    code: "chromium",
    label: "Chrome",
    symbol: "Cr",
    unit: "µg",
    recommendedDailyIntake: 35,
    color: "#8b5cf6", // violet
  },
  selenium: {
    code: "selenium",
    label: "Sélénium",
    symbol: "Se",
    unit: "µg",
    recommendedDailyIntake: 55,
    color: "#ec4899", // rose
  },
  iron: {
    code: "iron",
    label: "Fer",
    symbol: "Fe",
    unit: "mg",
    recommendedDailyIntake: 18,
    color: "#ef4444", // rouge
  },
  calcium: {
    code: "calcium",
    label: "Calcium",
    symbol: "Ca",
    unit: "mg",
    recommendedDailyIntake: 1000,
    color: "#06b6d4", // cyan
  },
  potassium: {
    code: "potassium",
    label: "Potassium",
    symbol: "K",
    unit: "mg",
    recommendedDailyIntake: 2600,
    color: "#6366f1", // indigo
  },
  iodine: {
    code: "iodine",
    label: "Iode",
    symbol: "I",
    unit: "µg",
    recommendedDailyIntake: 150,
    color: "#14b8a6", // teal
  },
  copper: {
    code: "copper",
    label: "Cuivre",
    symbol: "Cu",
    unit: "mg",
    recommendedDailyIntake: 0.9,
    color: "#d97706", // orange
  },
  manganese: {
    code: "manganese",
    label: "Manganèse",
    symbol: "Mn",
    unit: "mg",
    recommendedDailyIntake: 2.3,
    color: "#64748b", // gris
  },
  molybdenum: {
    code: "molybdenum",
    label: "Molybdène",
    symbol: "Mo",
    unit: "µg",
    recommendedDailyIntake: 45,
    color: "#475569", // gris-bleu
  },
  vitamin_b12: {
    code: "vitamin_b12",
    label: "Vitamine B12",
    symbol: "B12",
    unit: "µg",
    recommendedDailyIntake: 2.4,
    color: "#3b82f6", // bleu
  },
  folate: {
    code: "folate",
    label: "Folate (B9)",
    symbol: "B9",
    unit: "µg",
    recommendedDailyIntake: 400,
    color: "#2563eb", // bleu foncé
  },
  vitamin_c: {
    code: "vitamin_c",
    label: "Vitamine C",
    symbol: "C",
    unit: "mg",
    recommendedDailyIntake: 90,
    color: "#f87171", // rouge clair
  },
  vitamin_e: {
    code: "vitamin_e",
    label: "Vitamine E",
    symbol: "E",
    unit: "mg",
    recommendedDailyIntake: 15,
    color: "#fb923c", // orange clair
  },
  vitamin_k: {
    code: "vitamin_k",
    label: "Vitamine K1",
    symbol: "K1",
    unit: "µg",
    recommendedDailyIntake: 120,
    color: "#22c55e", // vert
  },
  vitamin_k2: {
    code: "vitamin_k2",
    label: "Vitamine K2",
    symbol: "K2",
    unit: "µg",
    // Pas d'AJR officiel — 100µg/j est la valeur cible la plus souvent citée
    // (rôle cardiovasculaire/osseux, distinct de la K1). Natto, fromages
    // affinés, jaune d'œuf, foie en sont les sources principales.
    recommendedDailyIntake: 100,
    color: "#16a34a", // vert plus soutenu, distinct de la K1
  },
  biotin: {
    code: "biotin",
    label: "Biotine (B7)",
    symbol: "B7",
    unit: "µg",
    recommendedDailyIntake: 30,
    color: "#a855f7", // mauve
  },
  pantothenic: {
    code: "pantothenic",
    label: "Acide pantothénique (B5)",
    symbol: "B5",
    unit: "mg",
    recommendedDailyIntake: 5,
    color: "#d946ef", // magenta
  },
  niacin: {
    code: "niacin",
    label: "Niacine (B3)",
    symbol: "B3",
    unit: "mg",
    recommendedDailyIntake: 16,
    color: "#f472b6", // rose clair
  },
  riboflavin: {
    code: "riboflavin",
    label: "Riboflavine (B2)",
    symbol: "B2",
    unit: "mg",
    recommendedDailyIntake: 1.3,
    color: "#fdba74", // pêche
  },
  thiamine: {
    code: "thiamine",
    label: "Thiamine (B1)",
    symbol: "B1",
    unit: "mg",
    recommendedDailyIntake: 1.2,
    color: "#fed7aa", // beige
  },
};

export function getMicronutrientInfo(code: MicronutrientCode): MicronutrientInfo {
  return MICRONUTRIENT_DB[code];
}

export function getMicronutrientColor(code: MicronutrientCode): string {
  return MICRONUTRIENT_DB[code]?.color || "#6b7280";
}

export function getMicronutrientLabel(code: MicronutrientCode): string {
  return MICRONUTRIENT_DB[code]?.label || code;
}

/**
 * Format a micronutrient amount for display. Rounding everything to 0 decimals
 * (as this used to do) makes any real value under 1 — common for µg-scale
 * nutrients like B12 (2.4µg RDA) or a modest mg-scale dose (e.g. 0.4mg iodine)
 * — silently show as "0", which reads as "this food has none" when it isn't
 * true. Small values keep one decimal instead.
 */
export function formatMicroAmount(amount: number): string {
  if (amount === 0) return "0";
  if (amount < 10) return (Math.round(amount * 10) / 10).toString();
  return Math.round(amount).toString();
}

/**
 * Merge user-defined custom nutrients (see /api/custom-nutrients) into the shared
 * lookup table so every component that reads MICRONUTRIENT_DB[code] — trackers,
 * selectors, progress charts, the report — picks up their label/color/unit without
 * each needing its own fetch. Safe to call repeatedly (idempotent).
 */
export function mergeCustomNutrients(custom: MicronutrientInfo[]): void {
  for (const info of custom) {
    MICRONUTRIENT_DB[info.code] = info;
  }
}
