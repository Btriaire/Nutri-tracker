"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MagnifyingGlass, Plus, ArrowLeft, Spinner, CaretDown,
  ForkKnife, BookBookmark, CookingPot, Trash, Check,
} from "@phosphor-icons/react";
import MealBuilderModal from "./MealBuilderModal";
import FoodPictogram from "./FoodPictogram";
import type {
  FoodNutrition, FoodSearchResult, MealType, Lang,
  ServingOption, SavedMeal, Recipe,
} from "@/app/lib/types";
import { COMMON_SERVING_UNITS } from "@/app/lib/types";
import { scaleNutrition } from "@/app/lib/nutrition";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { emoji: "🥩", label: "Viandes",        query: "viande bœuf poulet porc",          g1: "#ef4444", g2: "#9f1239" },
  { emoji: "🐟", label: "Poissons",       query: "poisson saumon thon",              g1: "#0ea5e9", g2: "#0369a1" },
  { emoji: "🥚", label: "Œufs",           query: "œuf",                              g1: "#fbbf24", g2: "#d97706" },
  { emoji: "🧀", label: "Laitages",       query: "lait yaourt fromage",              g1: "#f59e0b", g2: "#b45309" },
  { emoji: "🌾", label: "Céréales",       query: "riz pâtes avoine quinoa",          g1: "#d97706", g2: "#92400e" },
  { emoji: "🥖", label: "Pain",           query: "pain baguette brioche",            g1: "#d97706", g2: "#78350f" },
  { emoji: "🥦", label: "Légumes",        query: "carotte brocoli courgette tomate", g1: "#22c55e", g2: "#15803d" },
  { emoji: "🍎", label: "Fruits",         query: "pomme banane fraise raisin",       g1: "#ef4444", g2: "#b91c1c" },
  { emoji: "🫘", label: "Légumineuses",   query: "lentilles pois chiche haricots",   g1: "#d97706", g2: "#92400e" },
  { emoji: "🥜", label: "Oléagineux",     query: "amandes noix noisettes",           g1: "#d97706", g2: "#78350f" },
  { emoji: "🧈", label: "Corps gras",     query: "beurre huile",                     g1: "#fbbf24", g2: "#ca8a04" },
  { emoji: "🍫", label: "Sucreries",      query: "chocolat gâteau biscuit",          g1: "#7c3aed", g2: "#3b0764" },
  { emoji: "🥤", label: "Boissons",       query: "jus soda café thé",                g1: "#0ea5e9", g2: "#0284c7" },
  { emoji: "🍿", label: "Snacks",         query: "chips crackers barre céréales",    g1: "#f59e0b", g2: "#d97706" },
  { emoji: "🫕", label: "Plats cuisinés", query: "plat cuisiné lasagne pizza",       g1: "#f97316", g2: "#9a3412" },
  { emoji: "🌿", label: "Épices",         query: "herbe épice sel ail",              g1: "#4ade80", g2: "#15803d" },
];

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  ciqual:      { label: "Ciqual ANSES",    color: "var(--fiber)"   },
  off:         { label: "Open Food Facts", color: "var(--steps)"   },
  usda:        { label: "USDA",            color: "var(--carbs)"   },
  edamam:      { label: "Edamam",          color: "#f59e0b"        },
  nutritionix: { label: "Nutritionix",     color: "#10b981"        },
  custom:      { label: "Personnel",       color: "var(--protein)" },
  recipe:      { label: "Recette",         color: "var(--calories)" },
  ai:     { label: "Nutri-AI",         color: "#a855f7" },
};


const MEAL_ICONS = ["🍽️","☕","🥗","🍱","🍜","🥙","🥪","🍛","🥘","🫕"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNutritionPer100g(food: FoodSearchResult): FoodNutrition {
  // nutrition is per servingSizeG — multiply by (100 / servingSizeG) to get per 100g
  // scaleNutrition(n, g) internally does ratio = g/100, so pass 10000/servingSizeG
  // to get ratio = 10000/servingSizeG/100 = 100/servingSizeG (correct factor)
  return scaleNutrition(food.nutrition, 10000 / Math.max(food.servingSizeG, 1));
}

function getServingOptions(food: FoodSearchResult): ServingOption[] {
  return food.servingOptions?.length ? food.servingOptions : COMMON_SERVING_UNITS;
}

// FoodImage is replaced by FoodPictogram (imported above)

const GROUP_COLORS: Record<string, string> = {
  "Glucides":  "var(--carbs)",
  "Lipides":   "var(--fat)",
  "Minéraux":  "#34d399",
  "Vitamines": "#f472b6",
  "Divers":    "var(--text-muted)",
};

function NutrientGroup({ label, rows, accent }: { label: string; rows: { l: string; v: number | null | undefined; u: string }[]; accent?: string }) {
  const visible = rows.filter((r) => r.v != null);
  if (!visible.length) return null;
  const color = accent ?? GROUP_COLORS[label.split(" ")[0]] ?? "var(--protein)";
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--border)" }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
      </div>
      <div>
        {visible.map(({ l, v, u }, i) => (
          <div key={l} className="flex justify-between items-center px-3 py-2"
            style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{l}</span>
            <span className="text-[12px] tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
              {u === "g" ? (Math.round((v ?? 0) * 10) / 10) : Math.round(v ?? 0)}<span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{u}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroPills({ n }: { n: FoodNutrition }) {
  return (
    <div className="flex gap-1.5">
      {[
        { l: "P", v: n.proteinG, c: "var(--protein)" },
        { l: "G", v: n.carbsG,   c: "var(--carbs)" },
        { l: "L", v: n.fatG,     c: "var(--fat)" },
        { l: "F", v: n.fiberG,   c: "var(--fiber)" },
      ].map(({ l, v, c }) => (
        <div key={l} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          <span className="text-[9px] font-bold" style={{ color: c }}>{l}</span>
          <span className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)" }}>{Math.round(v)}g</span>
        </div>
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab  = "aliments" | "repas" | "recettes";
type Step = "browse" | "configure" | "configure-recipe" | "save-meal";

export interface AddedInfo { name: string; calories: number }

interface Props {
  open:    boolean;
  meal:    MealType;
  date:    string;
  lang?:   Lang;
  onClose: () => void;
  onAdded: (info: AddedInfo) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FoodSearchModal({ open, meal, date, lang = "fr", onClose, onAdded }: Props) {
  const [tab, setTab]   = useState<Tab>("aliments");
  const [step, setStep] = useState<Step>("browse");

  // Aliments state
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiResults,   setAiResults]   = useState<FoodSearchResult[]>([]);
  const [aiSearching, setAiSearching] = useState(false);
  const [savedAiIds,  setSavedAiIds]  = useState<Set<string>>(new Set());
  const [savingAiId,  setSavingAiId]  = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<ServingOption | null>(null);
  const [customQty, setCustomQty]   = useState("1");
  const [useCustomG, setUseCustomG] = useState(false);
  const [customGrams, setCustomGrams] = useState("100");
  const [notes, setNotes]   = useState("");
  const [adding, setAdding] = useState(false);
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Repas state
  const [savedMeals, setSavedMeals]       = useState<SavedMeal[]>([]);
  const [loadingMeals, setLoadingMeals]   = useState(false);
  const [showMealBuilder, setShowMealBuilder] = useState(false);
  const [savingMeal, setSavingMeal]       = useState(false);
  const [newMealName, setNewMealName]     = useState("");
  const [newMealIcon, setNewMealIcon]     = useState("🍽️");
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null);
  const [addingMealId, setAddingMealId]   = useState<string | null>(null);

  // Recettes state
  const [recipes, setRecipes]           = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeServings, setRecipeServings] = useState("1");
  const [addingRecipe, setAddingRecipe]   = useState(false);

  // Portal mount (escape .glass backdrop-filter stacking context)
  const [mounted, setMounted] = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => { setMounted(true); }, []);

  const closeOverlay = () => {
    setSelected(null);
    setSelectedRecipe(null);
    setStep("browse");
    setShowDetails(false);
    setNotes("");
    setNewMealName("");
    setNewMealIcon("🍽️");
  };

  // Reset on open
  useEffect(() => {
    if (open) {
      setTab("aliments"); setStep("browse");
      setQuery(""); setResults([]); setAiResults([]); setSavedAiIds(new Set()); setSelected(null);
      setSelectedUnit(null); setCustomQty("1"); setUseCustomG(false); setCustomGrams("100");
      setNotes("");
      setNewMealName(""); setNewMealIcon("🍽️");
      setSelectedRecipe(null); setRecipeServings("1");
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  // Load saved meals when tab opens
  const loadMeals = useCallback(async () => {
    setLoadingMeals(true);
    try {
      const res  = await fetch("/api/meals");
      const json = await res.json() as { meals: SavedMeal[] };
      setSavedMeals(json.meals ?? []);
    } finally { setLoadingMeals(false); }
  }, []);

  // Load recipes when tab opens
  const loadRecipes = useCallback(async () => {
    setLoadingRecipes(true);
    try {
      const res  = await fetch("/api/recipes");
      const json = await res.json() as { recipes: Recipe[] };
      setRecipes(json.recipes ?? []);
    } finally { setLoadingRecipes(false); }
  }, []);

  useEffect(() => {
    if (open && tab === "repas")    loadMeals();
    if (open && tab === "recettes") loadRecipes();
  }, [open, tab, loadMeals, loadRecipes]);

  // ── Aliments ──────────────────────────────────────────────────────────────

  const browseCategory = (cat: typeof CATEGORIES[number]) => {
    setQuery(cat.label);
    setResults([]); setAiResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/food/search?q=${encodeURIComponent(cat.query)}&lang=${lang}`);
        const json = await res.json() as { results: FoodSearchResult[] };
        setResults(json.results ?? []);
      } finally { setSearching(false); }
    }, 50);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const doSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setAiResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/food/search?q=${encodeURIComponent(value)}&lang=${lang}`);
        const json = await res.json() as { results: FoodSearchResult[] };
        setResults(json.results ?? []);
      } finally { setSearching(false); }
    }, 320);
  };

  const handleAiSearch = async () => {
    if (!query.trim() || aiSearching) return;
    setAiResults([]);
    setAiSearching(true);
    try {
      const res  = await fetch(`/api/food/ai-search?q=${encodeURIComponent(query)}`);
      const json = await res.json() as { results?: FoodSearchResult[] };
      setAiResults(json.results ?? []);
    } catch { /* silent */ }
    finally { setAiSearching(false); }
  };

  const handleSaveAiToDb = async (r: FoodSearchResult) => {
    if (savingAiId || savedAiIds.has(r.id)) return;
    setSavingAiId(r.id);
    try {
      const res = await fetch("/api/custom-foods", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         r.name,
          servingSizeG: r.servingSizeG,
          servingLabel: r.servingLabel,
          nutrition:    r.nutrition,
        }),
      });
      if (res.ok) setSavedAiIds(prev => new Set(prev).add(r.id));
    } catch { /* silent */ }
    finally { setSavingAiId(null); }
  };

  const selectFood = (food: FoodSearchResult) => {
    setSelected(food);
    const opts = getServingOptions(food);
    setSelectedUnit(opts.find((o) => o.isDefault) ?? opts[0]);
    setCustomQty("1"); setUseCustomG(false);
    setCustomGrams(String(food.servingSizeG));
    setShowDetails(false);
    setStep("configure");
  };

  const effectiveGrams = () => {
    if (useCustomG) return Math.max(1, parseFloat(customGrams) || 0);
    return Math.max(1, (parseFloat(customQty) || 1) * (selectedUnit?.grams ?? 100));
  };

  const computedNutrition = (): FoodNutrition | null => {
    if (!selected) return null;
    const per100g = getNutritionPer100g(selected);
    return scaleNutrition(per100g, effectiveGrams());
  };

  const handleAddFood = async () => {
    if (!selected) return;
    setAdding(true);
    const grams     = effectiveGrams();
    const per100g   = getNutritionPer100g(selected);
    const nutrition = scaleNutrition(per100g, grams);
    const servingLabel = useCustomG
      ? `${grams}g`
      : `${customQty} ${selectedUnit?.label ?? "portion"} (${grams}g)`;

    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entry: {
            meal, foodId: selected.id, source: selected.source,
            name: selected.name, brand: selected.brand,
            servingLabel, servingGrams: grams,
            servingQty:  useCustomG ? grams : parseFloat(customQty) || 1,
            servingUnit: useCustomG ? "g" : (selectedUnit?.label ?? "g"),
            nutrition, notes: notes || undefined,
          },
        }),
      });
      if (!res.ok) return;
      onAdded({ name: selected.name, calories: Math.round(nutrition.calories) });
      onClose();
    } finally { setAdding(false); }
  };

  const handleQuickAdd = async (food: FoodSearchResult) => {
    setQuickAddingId(food.id);
    const opts    = getServingOptions(food);
    const unit    = opts.find((o) => o.isDefault) ?? opts[0];
    const grams   = unit?.grams ?? 100;
    const per100g = getNutritionPer100g(food);
    const nutrition = scaleNutrition(per100g, grams);
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entry: {
            meal, foodId: food.id, source: food.source,
            name: food.name, brand: food.brand,
            servingLabel: unit?.label ?? `${grams}g`,
            servingGrams: grams,
            servingQty: 1,
            servingUnit: unit?.label ?? "g",
            nutrition,
          },
        }),
      });
      if (!res.ok) return;
      onAdded({ name: food.name, calories: Math.round(nutrition.calories) });
      onClose();
    } finally { setQuickAddingId(null); }
  };

  // ── Repas ─────────────────────────────────────────────────────────────────

  const handleLogMeal = async (m: SavedMeal) => {
    setAddingMealId(m.id);
    try {
      await fetch("/api/log/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entries: m.entries.map((e) => ({
            meal,
            foodId:       e.foodId,
            source:       e.source,
            name:         e.name,
            brand:        e.brand,
            servingLabel: e.servingLabel,
            servingGrams: e.servingGrams,
            servingQty:   1,
            servingUnit:  e.servingLabel,
            nutrition:    e.nutrition,
          })),
        }),
      });
      onAdded({ name: m.name, calories: Math.round(m.totalNutrition.calories) });
      onClose();
    } finally { setAddingMealId(null); }
  };

  const handleDeleteMeal = async (id: string) => {
    setDeletingMealId(id);
    try {
      await fetch(`/api/meals/${id}`, { method: "DELETE" });
      setSavedMeals((prev) => prev.filter((m) => m.id !== id));
    } finally { setDeletingMealId(null); }
  };

  const handleSaveMeal = async () => {
    if (!newMealName.trim() || !selected) return;
    setSavingMeal(true);
    const grams     = effectiveGrams();
    const per100g   = getNutritionPer100g(selected);
    const nutrition = scaleNutrition(per100g, grams);

    try {
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMealName.trim(),
          icon: newMealIcon,
          entries: [{
            foodId: selected.id, source: selected.source,
            name: selected.name, brand: selected.brand,
            servingLabel: useCustomG ? `${grams}g` : `${customQty} ${selectedUnit?.label ?? "portion"} (${grams}g)`,
            servingGrams: grams, nutrition,
          }],
        }),
      });
      closeOverlay();
      setTab("repas");
      loadMeals();
    } finally { setSavingMeal(false); }
  };

  // ── Recettes ──────────────────────────────────────────────────────────────

  const selectRecipe = (r: Recipe) => {
    setSelectedRecipe(r);
    setRecipeServings("1");
    setStep("configure-recipe");
  };

  const handleAddRecipe = async () => {
    if (!selectedRecipe) return;
    setAddingRecipe(true);
    const servings = Math.max(0.1, parseFloat(recipeServings) || 1);
    const grams    = Math.round(selectedRecipe.gramsPerServing * servings);
    const nutrition = scaleNutrition(selectedRecipe.nutrition, servings);

    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entry: {
            meal,
            foodId:       selectedRecipe.id,
            source:       "recipe",
            name:         selectedRecipe.name,
            servingLabel: `${servings} portion${servings > 1 ? "s" : ""} (${grams}g)`,
            servingGrams: grams,
            servingQty:   servings,
            servingUnit:  "portion",
            nutrition,
          },
        }),
      });
      if (!res.ok) return;
      onAdded({ name: selectedRecipe.name, calories: Math.round(nutrition.calories) });
      onClose();
    } finally { setAddingRecipe(false); }
  };

  const cn = computedNutrition();

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!mounted) return null;

  const portal = createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* ── Main search sheet (always shows browse) ── */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl overflow-hidden"
            style={{
              background: "rgba(13,13,17,0.97)",
              border: "1px solid var(--border-strong)", borderBottom: "none",
              backdropFilter: "blur(24px)", height: "82vh",
            }}
          >
            {/* Drag handle + close button */}
            <div className="flex items-center justify-between pt-3 pb-1.5 px-4 flex-shrink-0">
              <div className="w-6" />
              <div className="w-8 h-1 rounded-full" style={{ background: "var(--border-strong)" }} />
              <button onClick={onClose} className="btn-icon w-6 h-6 flex-shrink-0"><X size={13} /></button>
            </div>

            {/* Tab bar — always at the top */}
            <div className="px-4 pb-0 pt-0 flex-shrink-0">
              <div className="flex gap-1 p-1 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                {([
                  { id: "aliments",  label: "Aliments",  Icon: ForkKnife },
                  { id: "repas",     label: "Repas",     Icon: CookingPot },
                  { id: "recettes",  label: "Recettes",  Icon: BookBookmark },
                ] as const).map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => setTab(id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                    style={{
                      background: tab === id ? "rgba(167,139,250,0.15)" : "transparent",
                      color:      tab === id ? "var(--protein)" : "var(--text-muted)",
                      border:     tab === id ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
                    }}>
                    <Icon size={12} weight={tab === id ? "fill" : "regular"} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search input — only for Aliments tab */}
            {tab === "aliments" && (
              <div className="px-4 pb-0 pt-2.5 flex-shrink-0 space-y-2">
                {/* Input row */}
                <div className="relative">
                  {searching
                    ? <Spinner size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--text-muted)" }} />
                    : <MagnifyingGlass size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  }
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => doSearch(e.target.value)}
                    placeholder="Rechercher un aliment…"
                    className="input pl-10 text-[14px]"
                    style={{ height: "44px" }}
                  />
                </div>

                {/* AI search pill — always visible when query is non-empty */}
                <AnimatePresence initial={false}>
                  {query.trim() && (
                    <motion.div
                      key="ai-pill"
                      initial={{ opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleAiSearch}
                          disabled={aiSearching}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
                          style={{
                            background:  aiSearching ? "rgba(168,85,247,0.18)" : "rgba(168,85,247,0.1)",
                            border:      "1px solid rgba(168,85,247,0.35)",
                            color:       "#a855f7",
                            boxShadow:   aiSearching ? "0 0 12px rgba(168,85,247,0.25)" : "none",
                          }}
                        >
                          {aiSearching
                            ? <Spinner size={11} className="animate-spin" />
                            : <span className="text-[13px] leading-none">✨</span>
                          }
                          {aiSearching
                            ? "Recherche IA en cours…"
                            : aiResults.length > 0
                              ? "Relancer Nutri-IA"
                              : "Rechercher avec Nutri-IA"
                          }
                        </button>
                        {aiResults.length > 0 && !aiSearching && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[10px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {aiResults.length} résultat{aiResults.length > 1 ? "s" : ""} IA
                          </motion.span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Divider */}
            <div className="h-px flex-shrink-0 mt-3" style={{ background: "var(--border)" }} />

            {/* Browse content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">

              {/* ── ALIMENTS ── */}
              {tab === "aliments" && (
                <div className="px-4 py-3">
                  {!query && (
                    <>
                      <p className="label-xs mb-3">Catégories</p>
                      <div className="grid grid-cols-4 gap-2">
                        {CATEGORIES.map((cat, i) => (
                          <motion.button key={cat.emoji}
                            initial={{ opacity: 0, scale: 0.88 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.18, delay: i * 0.022, ease: [0.34, 1.56, 0.64, 1] }}
                            onClick={() => browseCategory(cat)}
                            className="flex flex-col items-center gap-2 p-2.5 rounded-2xl transition-all"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                            whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.93 }}>
                            {/* Pictogram icon */}
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[22px] relative overflow-hidden flex-shrink-0"
                              style={{
                                background: `linear-gradient(145deg, ${cat.g1} 0%, ${cat.g2} 100%)`,
                                boxShadow: `0 3px 10px ${cat.g1}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
                              }}>
                              {/* Glass highlight */}
                              <div className="absolute inset-x-0 top-0 h-[48%] pointer-events-none"
                                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 100%)", borderRadius: "10px 10px 60% 60%" }} />
                              <span style={{ position: "relative", zIndex: 1 }}>{cat.emoji}</span>
                            </div>
                            <span className="text-[10px] font-medium leading-tight text-center" style={{ color: "var(--text-secondary)" }}>{cat.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </>
                  )}
                  {query && !searching && results.length === 0 && aiResults.length === 0 && !aiSearching && (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <span className="text-3xl">🔍</span>
                      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                        Aucun résultat pour &ldquo;{query}&rdquo;
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                        Essayez Nutri-IA via le bouton ci-dessus
                      </p>
                    </div>
                  )}
                  {aiResults.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[11px]">✨</span>
                        <p className="label-xs" style={{ color: "#a855f7" }}>Résultats Nutri-AI</p>
                        <p className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>— valeurs estimées</p>
                      </div>
                      <div className="space-y-1">
                        {aiResults.map((r) => {
                          const isAdding = quickAddingId === r.id;
                          return (
                            <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2 rounded-xl overflow-hidden"
                              style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)" }}>
                              <button onClick={() => selectFood(r)} className="flex-1 flex items-center gap-2.5 p-3 text-left min-w-0">
                                <FoodPictogram name={r.name} category={r.category} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-[13px] font-medium leading-snug flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-[14px] font-bold tabular-nums leading-tight" style={{ color: "var(--calories)" }}>{r.nutrition.calories}</p>
                                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/{r.servingSizeG}g</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
                                    <span className="text-[10px]" style={{ color: "#a855f7" }}>Nutri-AI</span>
                                  </div>
                                  <MacroPills n={r.nutrition} />
                                </div>
                              </button>
                              <button
                                onClick={() => handleQuickAdd(r)}
                                disabled={isAdding}
                                className="shrink-0 flex items-center justify-center w-11 self-stretch transition-all"
                                style={{ background: isAdding ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.1)", borderLeft: "1px solid rgba(168,85,247,0.2)" }}
                              >
                                  {isAdding
                                  ? <Spinner size={14} className="animate-spin" style={{ color: "#a855f7" }} />
                                  : <Plus size={16} weight="bold" style={{ color: "#a855f7" }} />
                                }
                              </button>
                              {/* Save to custom foods */}
                              {(() => {
                                const saved   = savedAiIds.has(r.id);
                                const saving  = savingAiId === r.id;
                                return (
                                  <button
                                    onClick={() => handleSaveAiToDb(r)}
                                    disabled={saved || saving}
                                    title={saved ? "Déjà sauvegardé" : "Sauvegarder dans ma base"}
                                    className="shrink-0 flex items-center justify-center w-9 self-stretch transition-all"
                                    style={{
                                      background: saved ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.03)",
                                      borderLeft: "1px solid rgba(168,85,247,0.15)",
                                    }}
                                  >
                                    {saving
                                      ? <Spinner size={12} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                                      : saved
                                        ? <Check size={13} weight="bold" style={{ color: "#34d399" }} />
                                        : <BookBookmark size={13} style={{ color: "var(--text-muted)" }} />
                                    }
                                  </button>
                                );
                              })()}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {!query && results.length > 0 && (
                    <p className="label-xs mb-2">Aliments détectés</p>
                  )}
                  <div className="space-y-1 mt-3">
                    {results.map((r) => {
                      const badge = SOURCE_BADGE[r.source];
                      const isAdding = quickAddingId === r.id;
                      return (
                        <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 rounded-xl overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                          {/* Tap to configure */}
                          <button onClick={() => selectFood(r)} className="flex-1 flex items-center gap-2.5 p-3 text-left min-w-0">
                            <FoodPictogram name={r.name} category={r.category} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[13px] font-medium leading-snug flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[14px] font-bold tabular-nums leading-tight" style={{ color: "var(--calories)" }}>{r.nutrition.calories}</p>
                                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/{r.servingSizeG}g</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
                                {r.brand && <span className="text-[11px] truncate max-w-[90px]" style={{ color: "var(--text-muted)" }}>{r.brand}</span>}
                                {r.brand && <span style={{ color: "var(--border-strong)" }}>·</span>}
                                <span className="text-[10px]" style={{ color: badge?.color ?? "var(--text-muted)" }}>{badge?.label}</span>
                              </div>
                              <MacroPills n={r.nutrition} />
                            </div>
                          </button>
                          {/* Quick add */}
                          <button
                            onClick={() => handleQuickAdd(r)}
                            disabled={isAdding}
                            className="shrink-0 flex items-center justify-center w-11 self-stretch transition-all"
                            style={{ background: isAdding ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.12)", borderLeft: "1px solid var(--border)" }}
                          >
                            {isAdding
                              ? <Spinner size={15} className="animate-spin" style={{ color: "var(--protein)" }} />
                              : <Plus size={17} weight="bold" style={{ color: "var(--protein)" }} />
                            }
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── REPAS ── */}
              {tab === "repas" && (
                <div className="px-4 py-4">
                  {/* Create meal button */}
                  <button
                    onClick={() => setShowMealBuilder(true)}
                    className="w-full flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl text-[13px] font-medium transition-all"
                    style={{
                      background: "rgba(167,139,250,0.1)",
                      border: "1px solid rgba(167,139,250,0.3)",
                      color: "var(--protein)",
                    }}
                  >
                    <Plus size={14} weight="bold" />
                    Créer un repas personnalisé
                  </button>

                  {loadingMeals && (
                    <div className="flex justify-center py-12">
                      <Spinner size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                    </div>
                  )}
                  {!loadingMeals && savedMeals.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <span className="text-4xl">🍽️</span>
                      <p className="text-[13px] text-center" style={{ color: "var(--text-muted)" }}>
                        Aucun repas sauvegardé.<br />Ajoutez un aliment, puis sauvegardez-le comme repas.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {savedMeals.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <span className="text-2xl flex-shrink-0">{m.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{m.name}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {m.entries.length} aliment{m.entries.length > 1 ? "s" : ""} · {Math.round(m.totalNutrition.calories)} kcal
                          </p>
                          <MacroPills n={m.totalNutrition} />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button onClick={() => handleLogMeal(m)}
                            disabled={addingMealId === m.id}
                            className="btn btn-primary px-3 py-1 text-[11px]" style={{ height: "28px" }}>
                            {addingMealId === m.id ? <Spinner size={11} className="animate-spin" /> : <><Plus size={11} /> Ajouter</>}
                          </button>
                          <button onClick={() => handleDeleteMeal(m.id)}
                            disabled={deletingMealId === m.id}
                            className="btn btn-ghost px-2 py-1 text-[11px]"
                            style={{ height: "24px", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                            {deletingMealId === m.id ? <Spinner size={10} className="animate-spin" /> : <Trash size={11} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── RECETTES ── */}
              {tab === "recettes" && (
                <div className="px-4 py-4">
                  {loadingRecipes && (
                    <div className="flex justify-center py-12">
                      <Spinner size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                    </div>
                  )}
                  {!loadingRecipes && recipes.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <span className="text-4xl">📖</span>
                      <p className="text-[13px] text-center" style={{ color: "var(--text-muted)" }}>
                        Aucune recette créée.<br />Créez vos recettes dans la bibliothèque.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {recipes.map((r) => (
                      <motion.button key={r.id} onClick={() => selectRecipe(r)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                        whileHover={{ background: "rgba(255,255,255,0.055)" }}>
                        <span className="text-2xl flex-shrink-0">🍳</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {r.servings} portion{r.servings > 1 ? "s" : ""} · {r.ingredients.length} ingrédient{r.ingredients.length > 1 ? "s" : ""}
                          </p>
                          <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--calories)" }}>
                            {Math.round(r.nutrition.calories)} kcal / portion
                          </p>
                        </div>
                        <Plus size={14} style={{ color: "var(--text-muted)" }} />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </motion.div>

          {/* ── Configure overlay panel (popup over search) ── */}

          {step !== "browse" && (
            <div
              className="fixed inset-0"
              style={{ zIndex: 55, background: "rgba(0,0,0,0.45)" }}
              onClick={closeOverlay}
            />
          )}

          {step !== "browse" && (
            <div
              className="fixed inset-x-0 bottom-0 flex flex-col rounded-t-2xl overflow-hidden"
              style={{
                zIndex: 60,
                background: "rgba(15,15,22,0.99)",
                border: "1px solid var(--border-strong)", borderBottom: "none",
                backdropFilter: "blur(28px)",
                maxHeight: "88vh",
              }}
            >
                  {/* Drag handle */}
                  <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                    <div className="w-8 h-1 rounded-full" style={{ background: "var(--border-strong)" }} />
                  </div>

                  {/* Panel header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
                    style={{ borderBottom: "1px solid var(--border)" }}>
                    {step === "save-meal" ? (
                      <button onClick={() => setStep("configure")} className="btn-icon flex-shrink-0">
                        <ArrowLeft size={13} />
                      </button>
                    ) : (
                      <button onClick={closeOverlay} className="btn-icon flex-shrink-0">
                        <X size={13} />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      {step === "configure" && selected && (
                        <div>
                          <p className="font-semibold text-[14px] truncate" style={{ color: "var(--text-primary)" }}>{selected.name}</p>
                          {selected.brand && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{selected.brand}</p>}
                        </div>
                      )}
                      {step === "configure-recipe" && selectedRecipe && (
                        <div>
                          <p className="font-semibold text-[14px] truncate" style={{ color: "var(--text-primary)" }}>{selectedRecipe.name}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{selectedRecipe.servings} portion{selectedRecipe.servings > 1 ? "s" : ""} · {selectedRecipe.totalGrams}g total</p>
                        </div>
                      )}
                      {step === "save-meal" && (
                        <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Sauvegarder comme repas</p>
                      )}
                    </div>
                    {step === "configure" && selected && (
                      <span className="badge flex-shrink-0"
                        style={{ borderColor: `${SOURCE_BADGE[selected.source]?.color}40`, color: SOURCE_BADGE[selected.source]?.color }}>
                        {SOURCE_BADGE[selected.source]?.label ?? selected.source}
                      </span>
                    )}
                  </div>

                  {/* Panel content */}
                  <div className="flex-1 overflow-y-auto overscroll-contain">

                    {/* ── CONFIGURE food ── */}
                    {step === "configure" && selected && (
                      <div className="px-4 py-4 space-y-5 pb-8">

                        {/* Serving */}
                        <div>
                          <p className="label-xs mb-2">Portion</p>
                          {!useCustomG ? (
                            <>
                              <div className="flex gap-2 overflow-x-auto pb-2 mb-1"
                                style={{ scrollbarWidth: "none" }}>
                                {getServingOptions(selected).map((opt) => (
                                  <button key={opt.label} onClick={() => setSelectedUnit(opt)}
                                    className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors"
                                    style={{
                                      background: selectedUnit?.label === opt.label ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                                      border: `1px solid ${selectedUnit?.label === opt.label ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                                      color: selectedUnit?.label === opt.label ? "var(--protein)" : "var(--text-secondary)",
                                    }}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <button onClick={() => setCustomQty((v) => String(Math.max(0.5, (parseFloat(v)||1) - ((selectedUnit?.grams ?? 0) >= 50 ? 1 : 0.5))))}
                                    className="btn-icon w-8 h-8 text-lg">−</button>
                                  <input type="number" value={customQty} min="0.5" step="0.5"
                                    onChange={(e) => setCustomQty(e.target.value)}
                                    className="input text-center w-16 tabular-nums" />
                                  <button onClick={() => setCustomQty((v) => String((parseFloat(v)||1) + ((selectedUnit?.grams ?? 0) >= 50 ? 1 : 0.5)))}
                                    className="btn-icon w-8 h-8 text-lg">+</button>
                                </div>
                                <span className="text-[12px] flex-1" style={{ color: "var(--text-muted)" }}>
                                  = {Math.round(effectiveGrams())}g
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-3">
                              <input type="number" value={customGrams} min="1"
                                onChange={(e) => setCustomGrams(e.target.value)}
                                className="input w-24 tabular-nums" />
                              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>grammes</span>
                            </div>
                          )}
                          <button onClick={() => setUseCustomG((v) => !v)}
                            className="mt-2 text-[11px] transition-colors"
                            style={{ color: "var(--text-muted)" }}>
                            {useCustomG ? "← Utiliser les unités" : "Saisir en grammes →"}
                          </button>
                        </div>

                        {/* Nutrition preview */}
                        {cn && (
                          <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                            {/* Calorie hero */}
                            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[34px] font-bold tabular-nums leading-none" style={{ color: "var(--calories)" }}>
                                  {Math.round(cn.calories)}
                                </span>
                                <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>kcal</span>
                              </div>
                              <div className="px-2.5 py-1 rounded-lg"
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
                                <span className="text-[12px] tabular-nums font-medium" style={{ color: "var(--text-secondary)" }}>
                                  {Math.round(effectiveGrams())} g
                                </span>
                              </div>
                            </div>

                            {/* Macro ratio bar */}
                            {(() => {
                              const total = cn.proteinG + cn.carbsG + cn.fatG;
                              if (total === 0) return null;
                              return (
                                <div className="mx-4 mb-3 h-2 rounded-full overflow-hidden flex">
                                  <div style={{ width: `${cn.proteinG / total * 100}%`, background: "var(--protein)" }} />
                                  <div style={{ width: `${cn.carbsG   / total * 100}%`, background: "var(--carbs)" }} />
                                  <div style={{ width: `${cn.fatG     / total * 100}%`, background: "var(--fat)" }} />
                                </div>
                              );
                            })()}

                            {/* Macro values */}
                            <div className="grid grid-cols-4" style={{ borderTop: "1px solid var(--border)" }}>
                              {[
                                { l: "Protéines", v: cn.proteinG, c: "var(--protein)" },
                                { l: "Glucides",  v: cn.carbsG,   c: "var(--carbs)" },
                                { l: "Lipides",   v: cn.fatG,     c: "var(--fat)" },
                                { l: "Fibres",    v: cn.fiberG,   c: "var(--fiber)" },
                              ].map(({ l, v, c }, i) => (
                                <div key={l} className="flex flex-col items-center py-3"
                                  style={{ borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}>
                                  <span className="text-[14px] font-bold tabular-nums" style={{ color: c }}>
                                    {Math.round(v * 10) / 10}<span className="text-[10px] font-normal ml-px" style={{ color: "var(--text-muted)" }}>g</span>
                                  </span>
                                  <span className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{l}</span>
                                </div>
                              ))}
                            </div>

                            {/* Toggle details */}
                            <button
                              onClick={() => setShowDetails(v => !v)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] transition-colors"
                              style={{ color: showDetails ? "var(--protein)" : "var(--text-muted)", borderTop: "1px solid var(--border)" }}
                            >
                              <motion.span animate={{ rotate: showDetails ? 180 : 0 }} transition={{ duration: 0.2 }}
                                style={{ display: "inline-flex" }}>
                                <CaretDown size={10} />
                              </motion.span>
                              {showDetails ? "Masquer les détails" : "Voir les détails nutritionnels"}
                            </button>

                            <AnimatePresence initial={false}>
                              {showDetails && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                  style={{ overflow: "hidden", borderTop: "1px solid var(--border)" }}
                                >
                                  <div className="p-3 space-y-3 text-[12px]">
                                    {(cn.sugarG != null || cn.starchG != null) && (
                                      <NutrientGroup label="Glucides détail" rows={[
                                        { l: "dont Sucres", v: cn.sugarG,  u: "g" },
                                        { l: "dont Amidon", v: cn.starchG, u: "g" },
                                      ]} />
                                    )}
                                    {(cn.saturatedFatG != null || cn.monounsatFatG != null || cn.polyunsatFatG != null || cn.transFatG != null || cn.cholesterolMg != null) && (
                                      <NutrientGroup label="Lipides détail" rows={[
                                        { l: "Saturés",        v: cn.saturatedFatG, u: "g" },
                                        { l: "Mono-insaturés", v: cn.monounsatFatG, u: "g" },
                                        { l: "Poly-insaturés", v: cn.polyunsatFatG, u: "g" },
                                        { l: "Trans",          v: cn.transFatG,     u: "g" },
                                        { l: "Cholestérol",    v: cn.cholesterolMg, u: "mg" },
                                      ]} />
                                    )}
                                    {(cn.sodiumMg != null || cn.potassiumMg != null || cn.calciumMg != null || cn.magneziumMg != null || cn.ironMg != null || cn.zincMg != null) && (
                                      <NutrientGroup label="Minéraux" rows={[
                                        { l: "Sodium",    v: cn.sodiumMg,    u: "mg" },
                                        { l: "Potassium", v: cn.potassiumMg, u: "mg" },
                                        { l: "Calcium",   v: cn.calciumMg,   u: "mg" },
                                        { l: "Magnésium", v: cn.magneziumMg, u: "mg" },
                                        { l: "Fer",       v: cn.ironMg,      u: "mg" },
                                        { l: "Zinc",      v: cn.zincMg,      u: "mg" },
                                      ]} />
                                    )}
                                    {(cn.vitaminCMg != null || cn.vitaminDUg != null || cn.vitaminAUg != null || cn.vitaminB12Ug != null || cn.vitaminB9Ug != null) && (
                                      <NutrientGroup label="Vitamines" rows={[
                                        { l: "Vitamine C",   v: cn.vitaminCMg,   u: "mg" },
                                        { l: "Vitamine D",   v: cn.vitaminDUg,   u: "µg" },
                                        { l: "Vitamine A",   v: cn.vitaminAUg,   u: "µg" },
                                        { l: "Vitamine B12", v: cn.vitaminB12Ug, u: "µg" },
                                        { l: "Folate (B9)",  v: cn.vitaminB9Ug,  u: "µg" },
                                      ]} />
                                    )}
                                    {(cn.waterG != null || cn.saltG != null || cn.alcoholG != null) && (
                                      <NutrientGroup label="Divers" rows={[
                                        { l: "Eau",    v: cn.waterG,   u: "g" },
                                        { l: "Sel",    v: cn.saltG,    u: "g" },
                                        { l: "Alcool", v: cn.alcoholG, u: "g" },
                                      ]} />
                                    )}
                                    {cn.sugarG == null && cn.saturatedFatG == null && cn.sodiumMg == null && cn.vitaminCMg == null && (
                                      <p className="text-center py-2" style={{ color: "var(--text-muted)" }}>
                                        Micronutriments non disponibles pour cette source
                                      </p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Notes */}
                        <div>
                          <p className="label-xs mb-1.5">Note (optionnel)</p>
                          <input value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ex : avec vinaigrette…"
                            className="input text-[13px]" />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button onClick={handleAddFood} disabled={adding}
                            className="btn btn-primary flex-1 gap-2">
                            {adding ? <Spinner size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />}
                            Ajouter au journal
                          </button>
                          <button onClick={() => setStep("save-meal")}
                            className="btn btn-ghost gap-1.5 text-[12px] px-3"
                            title="Sauvegarder comme repas">
                            <CookingPot size={14} />
                            Sauver
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── SAVE MEAL ── */}
                    {step === "save-meal" && selected && (
                      <div className="px-4 py-4 space-y-4 pb-8">
                        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          Sauvegarder <strong style={{ color: "var(--text-primary)" }}>{selected.name}</strong> comme modèle de repas réutilisable.
                        </p>
                        <div>
                          <p className="label-xs mb-1.5">Nom du repas</p>
                          <input value={newMealName} onChange={(e) => setNewMealName(e.target.value)}
                            placeholder="Ex : Petit-déj habituel…"
                            className="input" />
                        </div>
                        <div>
                          <p className="label-xs mb-2">Icône</p>
                          <div className="flex flex-wrap gap-2">
                            {MEAL_ICONS.map((icon) => (
                              <button key={icon} onClick={() => setNewMealIcon(icon)}
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all"
                                style={{
                                  background: newMealIcon === icon ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${newMealIcon === icon ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                                }}>
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button onClick={handleSaveMeal} disabled={savingMeal || !newMealName.trim()}
                          className="btn btn-primary w-full gap-2">
                          {savingMeal ? <Spinner size={14} className="animate-spin" /> : <Check size={14} weight="bold" />}
                          Sauvegarder le repas
                        </button>
                      </div>
                    )}

                    {/* ── CONFIGURE recipe ── */}
                    {step === "configure-recipe" && selectedRecipe && (
                      <div className="px-4 py-4 space-y-5 pb-8">
                        <div>
                          <p className="label-xs mb-2">Ingrédients ({selectedRecipe.ingredients.length})</p>
                          <div className="space-y-1">
                            {selectedRecipe.ingredients.map((ing, i) => (
                              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg"
                                style={{ background: "rgba(255,255,255,0.03)" }}>
                                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{ing.name}</span>
                                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{ing.grams}g</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="label-xs mb-2">Nombre de portions</p>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setRecipeServings((v) => String(Math.max(0.5, (parseFloat(v)||1) - 0.5)))}
                              className="btn-icon w-9 h-9 text-lg">−</button>
                            <input type="number" value={recipeServings} min="0.5" step="0.5"
                              onChange={(e) => setRecipeServings(e.target.value)}
                              className="input text-center w-20 tabular-nums" />
                            <button onClick={() => setRecipeServings((v) => String((parseFloat(v)||1) + 0.5))}
                              className="btn-icon w-9 h-9 text-lg">+</button>
                          </div>
                        </div>
                        {(() => {
                          const servings = Math.max(0.1, parseFloat(recipeServings) || 1);
                          const n = scaleNutrition(selectedRecipe.nutrition, servings);
                          return (
                            <div className="p-3 rounded-xl space-y-2"
                              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                                  {Math.round(n.calories)} kcal
                                </span>
                                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  {Math.round(selectedRecipe.gramsPerServing * servings)}g
                                </span>
                              </div>
                              <MacroPills n={n} />
                            </div>
                          );
                        })()}
                        <button onClick={handleAddRecipe} disabled={addingRecipe}
                          className="btn btn-primary w-full gap-2">
                          {addingRecipe ? <Spinner size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />}
                          Ajouter au journal
                        </button>
                      </div>
                    )}

                  </div>
                </div>
            )}

        </>
      )}
    </AnimatePresence>,
    document.body
  );

  return (
    <>
      {portal}
      <MealBuilderModal
        open={showMealBuilder}
        lang={lang}
        onClose={() => setShowMealBuilder(false)}
        onSaved={() => { loadMeals(); setTab("repas"); }}
      />
    </>
  );
}
