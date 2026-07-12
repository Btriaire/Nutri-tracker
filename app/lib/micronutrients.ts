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
    unit: "IU",
    recommendedDailyIntake: 600,
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
    label: "Vitamine K",
    symbol: "K",
    unit: "µg",
    recommendedDailyIntake: 120,
    color: "#22c55e", // vert
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
