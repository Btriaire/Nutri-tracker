import type { Timestamp } from "firebase-admin/firestore";

// ─── Primitives ────────────────────────────────────────────────────────────────

export type WeeklyGoal    = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Lang          = "fr" | "en";
export type MealType      = "breakfast" | "lunch" | "dinner" | "snacks";
export type FoodSource    = "ciqual" | "off" | "usda" | "custom" | "recipe" | "ai" | "edamam" | "nutritionix";
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
  imageUrl?:    string;
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
  date:        string;     // YYYY-MM-DD
  entries:     FoodEntry[];
  totals:      DayTotals;
  waterMl:     number;     // hydratation du jour
  mealHunger?: Partial<Record<MealType, HungerLevel>>; // faim par repas
  updatedAt:   Timestamp;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export type Gender = "male" | "female";

export interface NutritionGoals {
  dailyCalories:    number;
  proteinGrams:     number;
  carbsGrams:       number;
  fatGrams:         number;
  fiberGrams:       number;
  sugarGrams?:        number;
  sodiumMg?:          number;
  saturatedFatGrams?: number;
  waterMl:            number;   // objectif eau quotidien en ml
  targetWeightKg:   number | null;
  targetDate?:      string;         // "YYYY-MM-DD" cible utilisateur
  weeklyGoal:       WeeklyGoal;
  activityLevel:    ActivityLevel;
  stepsGoal:        number;
  sleepGoalMin:     number;
  age?:             number;
  heightCm?:        number;
  gender?:          Gender;
  currentWeightKg?: number;   // pour tracking
  plan?:            NutritionPlan;
  activityPlan?:    ActivityPlan;
  deductBurnedCalories?: boolean;   // false = ne pas soustraire les calories brûlées du budget
}

export interface PlannedActivity {
  id:           string;
  label:        string;
  emoji:        string;
  category:     "sport" | "leisure";
  durationMin:  number;         // durée par séance
  kcalPer30min: number;         // calories brûlées / 30 min (selon poids moyen 75kg)
}

export interface ActivityPlan {
  sessionsPerWeek: number;
  activities:      PlannedActivity[];
  weeklyKcalBurned: number;     // sum(activity.kcalPer30min * durationMin / 30) * sessionsPerWeek
}

export interface NutritionPlan {
  programKey:              string;        // "keto"|"balanced"|"lowcarb"|"highprot"|"mediter"|"bulk"
  programLabel:            string;        // "Cétogène", "Équilibré", etc.
  programEmoji:            string;        // "🥑", "⚖️", etc.
  startDate:               string;        // "YYYY-MM-DD"
  startWeightKg:           number | null;
  targetWeightKg:          number | null;
  dailyCalories:           number;
  projectedTargetDate?:    string;        // "YYYY-MM-DD" (from Groq)
  projectedWeeklyLossKg?:  number;        // from Groq
  projectedNote?:          string;        // short text from Groq
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
    googleFit:   IntegrationStatus;
    withings:    IntegrationStatus;
    appleHealth?: IntegrationStatus & { token?: string };
  };
  chartPrefs?:  ChartPrefs;
  photoUrl?:    string;
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
  sleepMinutes:          number | null;    // actual sleep (light+deep+REM)
  timeInBedMinutes:      number | null;    // total in-bed (includes awake)
  lightSleepMin:         number | null;
  deepSleepMin:          number | null;
  remSleepMin:           number | null;
  sleepSyncedAt?:        string;           // ISO date of the sleep session
  sessions:              { id: string; name: string; activityType: number; durationMin: number; startMs: number; endMs: number; calories: number | null }[];
  syncedAt:              Timestamp;
}

export interface WithingsDay {
  weightKg:      number | null;
  bodyFatPct:    number | null;
  bmi:           number | null;
  muscleMassKg:  number | null;
  fatMassKg:     number | null;
  boneMassKg:    number | null;
  hydrationPct:  number | null;
  visceralFat:   number | null;
  spO2Pct:       number | null;
  restingHR:     number | null;
  tempCelsius:   number | null;
  systolicBP:    number | null;
  diastolicBP:   number | null;
  measuredAt:    Timestamp | null;
  syncedAt:      Timestamp;
}

export interface WithingsSleepDay {
  totalSleepSec: number | null;
  deepSleepSec:  number | null;
  lightSleepSec: number | null;
  remSleepSec:   number | null;
  sleepScore:    number | null;
  hrAvgSleep:    number | null;
  snoringSec:    number | null;
  wakeupCount:   number | null;
  syncedAt:      Timestamp;
}

export interface AppleHealthDay {
  steps:            number;
  activeCalories:   number;
  activeMinutes:    number;
  heartRateAvg:     number | null;
  heartRateResting: number | null;
  hrv:              number | null;
  spO2:             number | null;
  sleepMinutes:     number | null;
  sleepLightMinutes: number | null;
  sleepDeepMinutes: number | null;
  sleepRemMinutes:  number | null;
  distanceKm:       number | null;
  vo2Max:           number | null;
  weightKg:         number | null;
  workouts:         { type: string; durationMin: number; calories: number }[];
  syncedAt:         Timestamp;
}

export interface GFitSessionEdit {
  name?:        string;
  calories?:    number | null;
  durationMin?: number;
}

export interface FitnessDay {
  date:           string;
  googleFit?:     GoogleFitDay;
  withings?:      WithingsDay;
  withingsSleep?: WithingsSleepDay;
  appleHealth?:   AppleHealthDay;
  manualSleep?:   { sleepMinutes: number | null };  // manual override, never overwritten by sync
  sessionEdits?:  Record<string, GFitSessionEdit>;  // user edits for GFit sessions — never overwritten by sync
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

// ─── Manual Activity ──────────────────────────────────────────────────────────

export interface ManualActivity {
  id:             string;
  date:           string;     // YYYY-MM-DD
  name:           string;
  activityType:   number;     // matches Google Fit activity codes (1=running, 7=cycling, 9=aerobics, etc.)
  durationMin:    number;
  caloriesBurned: number | null;
  notes?:         string;
  photoDataUrl?:  string;     // base64 JPEG 72×72 thumbnail
  loggedAt:       Timestamp;
  sets?:          number;
  reps?:          number;
  weightKg?:      number | null;
  weightPerSet?:  number[] | null;
}

// ─── Trend Data ───────────────────────────────────────────────────────────────

export interface DayTrendPoint {
  date:          string;
  calories:      number;
  proteinG:      number;
  carbsG:        number;
  fatG:          number;
  waterMl?:      number;
  steps?:        number;
  weightKg?:     number;
  burned?:       number;
  activeMinutes?: number;
  sleepMinutes?:  number;
  heartRateAvg?:  number;
}

// ─── Health Vitals ────────────────────────────────────────────────────────────

export type BPMoment = "morning" | "evening" | "other";

export interface BloodPressureReading {
  systolic:   number;   // mmHg
  diastolic:  number;   // mmHg
  pulse?:     number;   // bpm
  time:       string;   // "HH:MM"
  moment?:    BPMoment;
}

export interface MedicationEntry {
  id:     string;   // uuid-like
  name:   string;
  dose?:  string;   // "500 mg", "2 comprimés", etc.
  time?:  string;   // "HH:MM"
  taken:  boolean;
}

export type SymptomSeverity = "léger" | "modéré" | "sévère";

export interface SymptomEntry {
  id:           string;
  category:     string;       // e.g. "douleur"
  name:         string;       // e.g. "Maux de tête"
  severity?:    SymptomSeverity;
  time?:        string;       // "HH:MM" — heure de début
  endTime?:     string;       // "HH:MM" — heure de fin
  endDate?:     string;       // "YYYY-MM-DD" si fin un autre jour
  durationMin?: number;       // durée calculée en minutes
}

export interface AISynthesisResult {
  alertLevel:      "vert" | "orange" | "rouge";
  alertLabel:      string;
  summary:         string;
  vitaux:          string;
  symptomes:       string | null;
  nutrition:       string;
  activite:        string | null;
  recommandations: string[];
  consulter:       string | null;
  generatedAt?:    string; // ISO
}

export interface HealthEntry {
  date:           string;
  bloodPressure:  BloodPressureReading[];
  restingHR?:     number;   // bpm
  bloodGlucose?:  number;   // mmol/L
  spO2?:          number;   // %
  temperatureC?:  number;   // °C
  notes?:         string;
  medications?:   MedicationEntry[];
  symptoms?:      SymptomEntry[];
  aiSynthesis?:   AISynthesisResult;
  updatedAt?:     Timestamp;
}

// ─── Chart Preferences ────────────────────────────────────────────────────────

export type ChartType = "area" | "bar" | "line";

export interface TrackedNutrients {
  protein:      boolean;   // Protéines (g)
  sodium:       boolean;   // Sel (mg)
  sugar:        boolean;   // Sucre (g)
  saturatedFat: boolean;   // Lipides saturés (g)
}

export interface ChartPrefs {
  calorieTrend:       ChartType;       // default "area"
  macroDisplay:       "rings" | "bars" | "pie"; // default "rings"
  weightTrend:        ChartType;       // default "line"
  showMicroNutrients: boolean;         // default false
  showSleepData:      boolean;         // default true
  showHeartRate:      boolean;         // default true
  trackedNutrients?:  TrackedNutrients;
}
