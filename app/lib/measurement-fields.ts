export const MEASUREMENT_FIELDS = ["waistCm", "hipsCm", "chestCm", "armsCm", "thighsCm", "neckCm", "calfsCm"] as const;
export type MeasurementField = typeof MEASUREMENT_FIELDS[number];
export const MEASUREMENT_LABELS: Record<MeasurementField, string> = {
  waistCm: "Tour de taille", hipsCm: "Tour de hanches", chestCm: "Tour de poitrine",
  armsCm: "Tour de bras", thighsCm: "Tour de cuisses", neckCm: "Tour de cou", calfsCm: "Tour de mollets",
};
