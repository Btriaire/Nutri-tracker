// estimation d'une periode passee : un plan par jour, modifiable, puis les lignes du journal
import type { FoodEntry } from "./types";
import { dayTemplate, type DayQuality } from "./day-template";
import { DEFAULT_MEAL_SHARES, type MealShares } from "./meal-shares";
import { PERIOD_FOOD_PREFIX } from "./day-status";

export type PeriodQuality = "balanced" | "mixed" | "unbalanced";
export type EcartType = "repas" | "sucre" | "apero";
export type EcartSize = "petit" | "moyen" | "gros";

export interface Feeling {
  energy: number;
  mood: number;
  sleep: number;
}

export interface PeriodParams {
  from: string;
  to: string;
  kcal: number;
  quality: PeriodQuality;
  ecartsPerWeek: number;
  ecartType: EcartType;
  ecartSize: EcartSize;
  drinksPerWeek: number;
  activity: "faible" | "normale" | "elevee";
  feeling: Feeling;
  note: string;
}

export interface DayPlan {
  date: string;
  kcal: number;
  quality: DayQuality;
  ecart: { type: EcartType; size: EcartSize } | null;
  drinks: number;
  feeling: Feeling;
  note: string;
  confirmed: boolean;
}

export const MAX_PERIOD_DAYS = 93;

export const ECART_KCAL: Record<EcartType, Record<EcartSize, number>> = {
  repas: { petit: 400, moyen: 700, gros: 1000 },
  sucre: { petit: 200, moyen: 350, gros: 500 },
  apero: { petit: 250, moyen: 400, gros: 600 }
};

export const KCAL_PER_DRINK = 70;

function parseDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Invalid date format");
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Invalid date");
  }
  return date;
}

export function datesBetween(from: string, to: string): string[] {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error("From date must be before to date");
  }

  const days = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (days > MAX_PERIOD_DAYS) {
    throw new Error(`Period cannot exceed ${MAX_PERIOD_DAYS} days`);
  }

  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(fromDate);
    date.setUTCDate(fromDate.getUTCDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

function getWeekKey(dateStr: string): string {
  const date = parseDate(dateStr);
  const dayOfWeek = date.getUTCDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(date);
  weekStart.setUTCDate(date.getUTCDate() - diff);
  return weekStart.toISOString().split('T')[0];
}

function getDayOfWeek(dateStr: string): number {
  return parseDate(dateStr).getUTCDay();
}

export function planPeriod(p: PeriodParams, dates: string[]): DayPlan[] {
  if (p.kcal < 1000 || p.kcal > 5000) {
    throw new Error("kcal must be between 1000 and 5000");
  }

  if (p.ecartsPerWeek < 0 || p.ecartsPerWeek > 7) {
    throw new Error("ecartsPerWeek must be between 0 and 7");
  }

  if (p.drinksPerWeek < 0 || p.drinksPerWeek > 40) {
    throw new Error("drinksPerWeek must be between 0 and 40");
  }

  const weeks: Record<string, string[]> = {};

  for (const date of dates) {
    const weekKey = getWeekKey(date);
    if (!weeks[weekKey]) {
      weeks[weekKey] = [];
    }
    weeks[weekKey].push(date);
  }

  const ecartPriority = [6, 5, 0, 3, 4, 2, 1];
  const drinkPriority = [5, 6, 0, 4, 3, 2, 1];

  const plans: DayPlan[] = [];

  for (const date of dates) {
    const weekKey = getWeekKey(date);
    const weekDates = weeks[weekKey];
    const daysInWeek = weekDates.length;

    const ecartCount = Math.min(Math.round(p.ecartsPerWeek * daysInWeek / 7), daysInWeek);
    const drinkCount = Math.round(p.drinksPerWeek * daysInWeek / 7);

    const ecartDays = ecartPriority
      .map(dayOfWeek => weekDates.find(d => getDayOfWeek(d) === dayOfWeek))
      .filter(Boolean) as string[];

    const drinkDays = drinkPriority
      .map(dayOfWeek => weekDates.find(d => getDayOfWeek(d) === dayOfWeek))
      .filter(Boolean) as string[];

    const ecart = ecartDays.includes(date) && ecartDays.indexOf(date) < ecartCount
      ? { type: p.ecartType, size: p.ecartSize }
      : null;

    let drinks = 0;
    if (drinkDays.includes(date)) {
      const base = Math.floor(drinkCount / drinkDays.length);
      const remainder = drinkCount % drinkDays.length;
      const index = drinkDays.indexOf(date);
      drinks = base + (index < remainder ? 1 : 0);
    }

    const quality = p.quality === 'mixed'
      ? (dates.indexOf(date) % 2 === 0 ? 'balanced' : 'unbalanced')
      : p.quality;

    plans.push({
      date,
      kcal: p.kcal,
      quality: quality as DayQuality,
      ecart,
      drinks,
      feeling: { ...p.feeling },
      note: p.note,
      confirmed: false
    });
  }

  return plans;
}

export function dayPlanEntries(plan: DayPlan, periodId: string, shares: MealShares = DEFAULT_MEAL_SHARES): Omit<FoodEntry, "id" | "loggedAt">[] {
  const baseEntries = dayTemplate(plan.kcal, plan.quality, shares).map(entry => ({
    ...entry,
    foodId: PERIOD_FOOD_PREFIX + periodId,
    notes: "Estimation d'une période passée, pas une mesure"
  }));

  const entries: Omit<FoodEntry, "id" | "loggedAt">[] = [...baseEntries];

  if (plan.ecart) {
    const { type, size } = plan.ecart;
    const kcal = ECART_KCAL[type][size];
    const proteinPct = type === 'repas' ? 15 : type === 'sucre' ? 5 : 12;
    const fatPct = type === 'repas' ? 45 : type === 'sucre' ? 35 : 50;
    const carbsPct = type === 'repas' ? 40 : type === 'sucre' ? 60 : 38;
    const sugarPct = type === 'repas' ? 8 : type === 'sucre' ? 50 : 4;
    const saturatedFatPct = type === 'repas' ? 18 : type === 'sucre' ? 20 : 15;
    const fiberG = type === 'repas' ? 2 : type === 'sucre' ? 1 : 3;
    const sodiumMg = type === 'repas' ? 1.8 : type === 'sucre' ? 0.4 : 2.2;

    const proteinG = Math.round((kcal * proteinPct / 4) * 10) / 10;
    const fatG = Math.round((kcal * fatPct / 9) * 10) / 10;
    const carbsG = Math.round((kcal * carbsPct / 4) * 10) / 10;
    const sugarG = Math.round((kcal * sugarPct / 4) * 10) / 10;
    const saturatedFatG = Math.round((kcal * saturatedFatPct / 9) * 10) / 10;
    const saltG = Math.round((sodiumMg * kcal / 1000 * 2.5) * 10) / 10;

    const label = type === 'repas' ? 'repas copieux' : type === 'sucre' ? 'sucré' : 'apéritif';
    const meal = type === 'sucre' ? 'snacks' : 'dinner';

    entries.push({
      foodId: PERIOD_FOOD_PREFIX + periodId,
      meal,
      name: `Écart estimé : ${label}`,
      servingLabel: "1 écart estimé",
      servingGrams: Math.round(kcal / 2),
      servingQty: 1,
      servingUnit: "écart",
      nutrition: {
        calories: kcal,
        proteinG,
        fatG,
        carbsG,
        sugarG,
        saturatedFatG,
        fiberG,
        saltG,
        alcoholG: 0
      },
      source: "custom",
      notes: "Estimation d'une période passée, pas une mesure"
    });
  }

  if (plan.drinks > 0) {
    entries.push({
      foodId: PERIOD_FOOD_PREFIX + periodId,
      meal: "dinner",
      name: `Alcool estimé : ${plan.drinks} verre${plan.drinks > 1 ? "s" : ""}`,
      servingLabel: "verres estimés",
      servingGrams: plan.drinks * 100,
      servingQty: plan.drinks,
      servingUnit: "verre",
      nutrition: {
        calories: plan.drinks * KCAL_PER_DRINK,
        proteinG: 0,
        fatG: 0,
        carbsG: 0,
        sugarG: 0,
        saturatedFatG: 0,
        fiberG: 0,
        saltG: 0,
        alcoholG: plan.drinks * 10
      },
      source: "custom",
      notes: "Estimation d'une période passée, pas une mesure"
    });
  }

  return entries;
}

export function sanitizeDayPlan(x: unknown): DayPlan | null {
  if (typeof x !== 'object' || x === null) {
    return null;
  }

  const obj = x as Record<string, unknown>;

  const date = obj.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const kcal = obj.kcal;
  if (typeof kcal !== 'number' || kcal < 1000 || kcal > 5000) {
    return null;
  }

  const quality = obj.quality;
  if (typeof quality !== 'string' || !['balanced', 'unbalanced'].includes(quality)) {
    return null;
  }

  const ecart = obj.ecart;
  if (ecart !== null) {
    if (typeof ecart !== 'object' || ecart === null) {
      return null;
    }

    const ecartObj = ecart as Record<string, unknown>;

    const type = ecartObj.type;
    if (typeof type !== 'string' || !['repas', 'sucre', 'apero'].includes(type)) {
      return null;
    }

    const size = ecartObj.size;
    if (typeof size !== 'string' || !['petit', 'moyen', 'gros'].includes(size)) {
      return null;
    }
  }

  const drinks = obj.drinks;
  if (typeof drinks !== 'number' || drinks < 0 || drinks > 15 || !Number.isInteger(drinks)) {
    return null;
  }

  const feeling = obj.feeling;
  if (typeof feeling !== 'object' || feeling === null) {
    return null;
  }

  const feelingObj = feeling as Record<string, unknown>;

  const energy = feelingObj.energy;
  if (typeof energy !== 'number' || energy < 1 || energy > 5 || !Number.isInteger(energy)) {
    return null;
  }

  const mood = feelingObj.mood;
  if (typeof mood !== 'number' || mood < 1 || mood > 5 || !Number.isInteger(mood)) {
    return null;
  }

  const sleep = feelingObj.sleep;
  if (typeof sleep !== 'number' || sleep < 1 || sleep > 5 || !Number.isInteger(sleep)) {
    return null;
  }

  const note = obj.note;
  if (typeof note !== 'string') {
    return null;
  }

  const confirmed = obj.confirmed;
  if (typeof confirmed !== 'boolean') {
    return null;
  }

  return {
    date,
    kcal,
    quality: quality as DayQuality,
    ecart: ecart === null ? null : { type: (ecart as Record<string, unknown>).type as EcartType, size: (ecart as Record<string, unknown>).size as EcartSize },
    drinks,
    feeling: { energy, mood, sleep },
    note: note.length > 300 ? note.substring(0, 300) : note,
    confirmed
  };
}

export function sanitizePeriodParams(x: unknown): PeriodParams | null {
  if (typeof x !== 'object' || x === null) {
    return null;
  }

  const obj = x as Record<string, unknown>;

  const from = obj.from;
  if (typeof from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return null;
  }

  const to = obj.to;
  if (typeof to !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return null;
  }

  try {
    datesBetween(from, to);
  } catch {
    return null;
  }

  const kcal = obj.kcal;
  if (typeof kcal !== 'number' || kcal < 1000 || kcal > 5000) {
    return null;
  }

  const quality = obj.quality;
  if (typeof quality !== 'string' || !['balanced', 'mixed', 'unbalanced'].includes(quality)) {
    return null;
  }

  const ecartsPerWeek = obj.ecartsPerWeek;
  if (typeof ecartsPerWeek !== 'number' || ecartsPerWeek < 0 || ecartsPerWeek > 7 || !Number.isInteger(ecartsPerWeek)) {
    return null;
  }

  const ecartType = obj.ecartType;
  if (typeof ecartType !== 'string' || !['repas', 'sucre', 'apero'].includes(ecartType)) {
    return null;
  }

  const ecartSize = obj.ecartSize;
  if (typeof ecartSize !== 'string' || !['petit', 'moyen', 'gros'].includes(ecartSize)) {
    return null;
  }

  const drinksPerWeek = obj.drinksPerWeek;
  if (typeof drinksPerWeek !== 'number' || drinksPerWeek < 0 || drinksPerWeek > 40 || !Number.isInteger(drinksPerWeek)) {
    return null;
  }

  const activity = obj.activity;
  if (typeof activity !== 'string' || !['faible', 'normale', 'elevee'].includes(activity)) {
    return null;
  }

  const feeling = obj.feeling;
  if (typeof feeling !== 'object' || feeling === null) {
    return null;
  }

  const feelingObj = feeling as Record<string, unknown>;

  const energy = feelingObj.energy;
  if (typeof energy !== 'number' || energy < 1 || energy > 5 || !Number.isInteger(energy)) {
    return null;
  }

  const mood = feelingObj.mood;
  if (typeof mood !== 'number' || mood < 1 || mood > 5 || !Number.isInteger(mood)) {
    return null;
  }

  const sleep = feelingObj.sleep;
  if (typeof sleep !== 'number' || sleep < 1 || sleep > 5 || !Number.isInteger(sleep)) {
    return null;
  }

  const note = obj.note;
  if (typeof note !== 'string') {
    return null;
  }

  return {
    from,
    to,
    kcal,
    quality: quality as PeriodQuality,
    ecartsPerWeek,
    ecartType: ecartType as EcartType,
    ecartSize: ecartSize as EcartSize,
    drinksPerWeek,
    activity: activity as "faible" | "normale" | "elevee",
    feeling: { energy, mood, sleep },
    note: note.length > 300 ? note.substring(0, 300) : note
  };
}
