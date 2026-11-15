// etat d'un jour du journal (vide, partiel, estime, complet) et grille du calendrier

import type { FoodEntry } from "./types";
import { TEMPLATE_FOOD_ID } from "./day-template";

export const PERIOD_FOOD_PREFIX = "periode:";

export function isEstimatedEntry(e: { foodId?: string }): boolean {
  return e.foodId === TEMPLATE_FOOD_ID || e.foodId?.startsWith(PERIOD_FOOD_PREFIX) || false;
}

export type DayStatus = "vide" | "partiel" | "estime" | "complet";

export function dayStatus(entries: Pick<FoodEntry, "foodId" | "meal" | "nutrition">[], goalKcal: number): DayStatus {
  if (entries.length === 0) {
    return "vide";
  }

  if (entries.some(isEstimatedEntry)) {
    return "estime";
  }

  const meals = new Set(entries.map((entry) => entry.meal));
  const totalKcal = entries.reduce((sum, entry) => sum + entry.nutrition.calories, 0);

  if (meals.size < 2 || (Number.isFinite(goalKcal) && goalKcal > 0 && totalKcal < goalKcal * 0.5)) {
    return "partiel";
  }

  return "complet";
}

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  vide: "Vide",
  partiel: "Partiel",
  estime: "Estimé",
  complet: "Complet",
};

export function monthGrid(year: number, month1: number): (string | null)[] {
  const firstDay = new Date(Date.UTC(year, month1 - 1, 1));
  const lastDay = new Date(Date.UTC(year, month1, 0));
  const daysInMonth = lastDay.getUTCDate();
  const firstDayOfWeek = firstDay.getUTCDay();
  const daysBeforeFirstDay = (firstDayOfWeek + 6) % 7;

  const grid: (string | null)[] = Array(daysBeforeFirstDay).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month1 - 1, day));
    grid.push(date.toISOString().split("T")[0]);
  }

  const daysAfterLastDay = (7 - (grid.length % 7)) % 7;
  grid.push(...Array(daysAfterLastDay).fill(null));

  return grid;
}
