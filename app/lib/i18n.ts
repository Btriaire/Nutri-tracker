"use client";

import { createContext, useContext } from "react";
import type { Lang } from "./types";

const translations = {
  fr: {
    // Navigation
    dashboard: "Tableau de bord",
    log: "Journal",
    progress: "Progrès",
    settings: "Réglages",

    // Repas
    breakfast: "Petit-déjeuner",
    lunch: "Déjeuner",
    dinner: "Dîner",
    snacks: "Collations",

    // Macros
    calories: "Calories",
    protein: "Protéines",
    carbs: "Glucides",
    fat: "Lipides",
    fiber: "Fibres",
    sodium: "Sodium",
    sugar: "Sucres",

    // Dashboard
    netCalories: "Calories nettes",
    consumed: "Consommées",
    burned: "Brûlées",
    remaining: "Restantes",
    steps: "Pas",
    weight: "Poids",
    bodyFat: "Masse grasse",
    muscle: "Muscle",
    bmi: "IMC",
    goal: "Objectif",
    today: "Aujourd'hui",

    // Journal alimentaire
    addFood: "Ajouter un aliment",
    search: "Rechercher un aliment…",
    scanBarcode: "Scanner un code-barre",
    noResults: "Aucun résultat",
    searching: "Recherche…",
    serving: "Portion",
    servingSize: "Taille de la portion",
    quantity: "Quantité",
    unit: "Unité",
    add: "Ajouter",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    per100g: "Pour 100g",
    source: "Source",

    // Objectifs
    dailyCalories: "Calories journalières",
    proteinGoal: "Objectif protéines",
    carbsGoal: "Objectif glucides",
    fatGoal: "Objectif lipides",
    targetWeight: "Poids cible",
    weeklyGoal: "Objectif hebdomadaire",
    lose: "Perdre du poids",
    maintain: "Maintenir",
    gain: "Prendre du poids",
    activityLevel: "Niveau d'activité",
    sedentary: "Sédentaire",
    light: "Légèrement actif",
    moderate: "Modérément actif",
    active: "Actif",
    very_active: "Très actif",

    // Intégrations
    integrations: "Intégrations",
    connect: "Connecter",
    disconnect: "Déconnecter",
    connected: "Connecté",
    notConnected: "Non connecté",
    lastSync: "Dernière sync.",
    syncNow: "Synchroniser",
    googleFit: "Google Fit",
    withings: "Withings",

    // Auth
    login: "Connexion",
    logout: "Déconnexion",
    email: "E-mail",
    password: "Mot de passe",
    loginError: "Identifiants incorrects",

    // Divers
    save: "Enregistrer",
    saving: "Enregistrement…",
    loading: "Chargement…",
    error: "Erreur",
    success: "Succès",
    language: "Langue",
    kg: "kg",
    g: "g",
    kcal: "kcal",
    ml: "ml",
    noData: "Pas de données",
    recentFoods: "Aliments récents",
    frequentFoods: "Aliments fréquents",
  },
  en: {
    dashboard: "Dashboard",
    log: "Log",
    progress: "Progress",
    settings: "Settings",

    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snacks: "Snacks",

    calories: "Calories",
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
    fiber: "Fiber",
    sodium: "Sodium",
    sugar: "Sugar",

    netCalories: "Net Calories",
    consumed: "Consumed",
    burned: "Burned",
    remaining: "Remaining",
    steps: "Steps",
    weight: "Weight",
    bodyFat: "Body Fat",
    muscle: "Muscle",
    bmi: "BMI",
    goal: "Goal",
    today: "Today",

    addFood: "Add food",
    search: "Search for a food…",
    scanBarcode: "Scan barcode",
    noResults: "No results",
    searching: "Searching…",
    serving: "Serving",
    servingSize: "Serving size",
    quantity: "Quantity",
    unit: "Unit",
    add: "Add",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    per100g: "Per 100g",
    source: "Source",

    dailyCalories: "Daily calories",
    proteinGoal: "Protein goal",
    carbsGoal: "Carbs goal",
    fatGoal: "Fat goal",
    targetWeight: "Target weight",
    weeklyGoal: "Weekly goal",
    lose: "Lose weight",
    maintain: "Maintain",
    gain: "Gain weight",
    activityLevel: "Activity level",
    sedentary: "Sedentary",
    light: "Lightly active",
    moderate: "Moderately active",
    active: "Active",
    very_active: "Very active",

    integrations: "Integrations",
    connect: "Connect",
    disconnect: "Disconnect",
    connected: "Connected",
    notConnected: "Not connected",
    lastSync: "Last sync",
    syncNow: "Sync now",
    googleFit: "Google Fit",
    withings: "Withings",

    login: "Sign in",
    logout: "Sign out",
    email: "Email",
    password: "Password",
    loginError: "Invalid credentials",

    save: "Save",
    saving: "Saving…",
    loading: "Loading…",
    error: "Error",
    success: "Success",
    language: "Language",
    kg: "kg",
    g: "g",
    kcal: "kcal",
    ml: "ml",
    noData: "No data",
    recentFoods: "Recent foods",
    frequentFoods: "Frequent foods",
  },
} as const;

export type TranslationKey = keyof typeof translations.fr;
export type Translations = Record<TranslationKey, string>;

export const LangContext = createContext<Lang>("fr");

export function useTranslation() {
  const lang = useContext(LangContext);
  const t = (key: TranslationKey): string =>
    (translations[lang] as Translations)[key] ?? (translations.fr as Translations)[key];
  return { t, lang };
}

export function getTranslations(lang: Lang): Translations {
  return translations[lang] as Translations;
}
