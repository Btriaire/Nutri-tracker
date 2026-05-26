import type { Timestamp } from "firebase-admin/firestore";

// ─── Primitives ────────────────────────────────────────────────────────────────

export type WeeklyGoal    = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Lang          = "fr" | "en";
export type MealType      = "breakfast" | "lunch" | "dinner" | "snacks";
export type FoodSource    = "ciqual" | "off" | "usda" | "custom" | "recipe";
export type HungerLevel   = 1 | 2 | 3 | 4 | 5; // 1=pas faim, 5=très faim

// ─── Nutrition (full profile) ─────────────────────────────────────────────────

export interface FoodNutrition {
  // Macros (always present)
  calories:   number;
  proteinG:   number;
  carbsG:     number;
  fatG:       number;
  fiberG:     number;

  // Detailed carbs
  sugarG?:          number;
  starchG?:         number;

  // Detailed fats
  saturatedFatG?:   number;
  monounsatFatG?:   number;
  polyunsatFatG?:   number;
  transFatG?:       number;
  cholesterolMg?:   number;

  // Minerals
  sodiumMg?:        number;
  saltG?:           number;
  potassiumMg?:     number;
  calciumMg?:       number;
  magneziumMg?:     number;
  phosphorusMg?:    number;
  ironMg?:          number;
  zincMg?:          number;

  // Vitamins
  vitaminAUg?:      number;
  vitaminCMg?:      number;
  vitaminDUg?:      number;
  vitaminB12Ug?:    number;
  vitaminB9Ug?:     number; // folate

  // Other
  waterG?:          number;
  alcoholG?:        number;
  caffeineG?:       number;
}

// ─── Serving units ─────────────────────────────────────────────────────────────

export interface ServingOption {
  label:    string;   // "1 portion", "1 tranche", "1 c. à soupe"
  grams:    number;   // gram equivalent
  isDefault?: boolean;
}

export const COMMON_SERVING_UNITS: ServingOption[] = [
  { label: "100 g",         grams: 100, isDefault: true },
  { label: "50 g",          grams: 50 },
  { label: "150 g",         grams: 150 },
  { label: "200 g",         grams: 200 },
  { label: "250 g",         grams: 250 },
  { label: "300 g",         grams: 300 },
  { label: "1 portion",     grams: 150 },
  { label: "1 tranche",     grams: 30 },
  { label: "1 bol",         grams: 300 },
  { label: "1 assiette",    grams: 250 },
  { label: "1 verre",       grams: 200 },
  { label: "1 tasse",       grams: 240 },
  { label: "1 c. à soupe",  grams: 15 },
  { label: "1 c. à café",   grams: 5 },
  { label: "1 poignée",     grams: 30 },
  { label: "1 unité",       grams: 100 },
];

// ─── Food Search ──────────────────────────────────────────────────────────────

export interface FoodSearchResult {
  id:           string;   // "ciqual:1234" | "off:3017624010701" | "usda:567890"
  source:       FoodSource;
  name:         string;
  brand?:       string;
  category?:    string;
  servingSizeG: number;
  servingLabel: string;
  servingOptions?: ServingOption[];
  nutrition:    FoodNutrition;
}

// ─── Custom Foods ─────────────────────────────────────────────────────────────

export interface CustomFood {
  id:           string;
  name:         string;
  brand?:       string;
  category?:    string;
  servingSizeG: number;
  servingLabel: string;
  servingOptions?: ServingOption[];
  nutrition:    FoodNutrition;
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  foodId:       string;
  source:       FoodSource;
  name:         string;
  brand?:       string;
  grams:        number;
  nutrition:    FoodNutrition; // already scaled to grams
}

export interface Recipe {
  id:           string;
  name:         string;
  description?: string;
  servings:     number;         // nombre de portions que la recette fait
  totalGrams:   number;         // poids total de la recette
  gramsPerServing: number;      // totalGrams / servings
  ingredients:  RecipeIngredient[];
  nutrition:    FoodNutrition;  // per serving (sum / servings)
  nutritionPer100g: FoodNutrition;
  tags?:        string[];
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
}

// ─── Food Log ─────────────────────────────────────────────────────────────────

export interface FoodEntry {
  id:           string;
  meal:         MealType;
  foodId:       string;
  source:       FoodSource;
  name:         string;
  brand?:       string;

  // Serving
  servingLabel: string;   // human label ex. "2 tranches"
  servingGrams: number;   // actual grams consumed
  servingQty:   number;   // quantity (e.g. 2 if "2 tranches")
  servingUnit:  string;   // unit label (e.g. "tranche")

  // Full nutrition (already scaled to servingGrams)
  nutrition:    FoodNutrition;

  // User context
  notes?:       string;
  hunger?:      HungerLevel;
  loggedAt:     Timestamp;
}

export interface DayTotals {
  calories:   number;
  proteinG:   number;
  carbsG:     number;
  fatG:       number;
  fiberG:     number;
  // Extended
  sugarG?:    number;
  sodiumMg?:  number;
  saturatedFatG?: number;
}

export interface DayLog {
  date:       string;     // YYYY-MM-DD
  entries:    FoodEntry[];
  totals:     DayTotals;
  waterMl:    number;     // hydratation du jour
  updatedAt:  Timestamp;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface NutritionGoals {
  dailyCalories:    number;
  proteinGrams:     number;
  carbsGrams:       number;
  fatGrams:         number;
  fiberGrams:       number;
  sugarGrams?:      number;
  sodiumMg?:        number;
  waterMl:          number;   // objectif eau quotidien en ml
  targetWeightKg:   number | null;
  weeklyGoal:       WeeklyGoal;
  activityLevel:    ActivityLevel;
}

export interface IntegrationStatus {
  connected:    boolean;
  lastSyncedAt: Timestamp | null;
}

export interface UserProfile {
  email:        string;
  displayName:  string;
  lang:         Lang;
  createdAt:    Timestamp;
  goals:        NutritionGoals;
  integrations: {
    googleFit: IntegrationStatus;
    withings:  IntegrationStatus;
  };
}

// ─── Fitness Data ─────────────────────────────────────────────────────────────

export interface WorkoutSession {
  activityType:    number;
  activityName:    string;
  startTimeMs:     number;
  endTimeMs:       number;
  caloriesBurned:  number | null;
}

export interface GoogleFitDay {
  steps:                 number;
  activeCaloriesBurned:  number;
  activeMinutes:         number;
  heartRateAvg:          number | null;
  weightKg:              number | null;
  sleepMinutes:          number | null;
  sessions:              { id: string; name: string; activityType: number; durationMin: number; startMs: number }[];
  syncedAt:              Timestamp;
}

export interface WithingsDay {
  weightKg:     number | null;
  bodyFatPct:   number | null;
  bmi:          number | null;
  muscleMassKg: number | null;
  fatMassKg:    number | null;
  measuredAt:   Timestamp | null;
  syncedAt:     Timestamp;
}

export interface FitnessDay {
  date:       string;
  googleFit?: GoogleFitDay;
  withings?:  WithingsDay;
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export type OAuthProvider = "google_fit" | "withings";

export interface OAuthTokens {
  provider:     OAuthProvider;
  accessToken:  string;
  refreshToken: string;
  tokenType:    string;
  expiresAt:    Timestamp;
  scopes:       string[];
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
}

// ─── Saved Meals ──────────────────────────────────────────────────────────────

export interface SavedMealEntry {
  foodId:       string;
  source:       FoodSource;
  name:         string;
  brand?:       string;
  servingLabel: string;
  servingGrams: number;
  nutrition:    FoodNutrition;
}

export interface SavedMeal {
  id:             string;
  name:           string;
  icon:           string;
  entries:        SavedMealEntry[];
  totalNutrition: FoodNutrition;
  createdAt:      Timestamp;
  updatedAt:      Timestamp;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface WeightPoint {
  kg:   number;
  date: string;
}

export interface DashboardData {
  date:         string;
  goals:        NutritionGoals;
  consumed:     DayTotals;
  netCalories:  number;
  burned:       number | null;
  steps:        number | null;
  stepsGoal:    number;
  weight:       WeightPoint | null;
  recentWeight: WeightPoint[];
  waterMl:      number;
}
