"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MagnifyingGlass, Plus, ArrowLeft, Spinner,
  Smiley, SmileyMeh, SmileySad, SmileyBlank, SmileyXEyes,
  ForkKnife, BookBookmark, CookingPot, Trash, Check,
} from "@phosphor-icons/react";
import type {
  FoodNutrition, FoodSearchResult, HungerLevel, MealType, Lang,
  ServingOption, SavedMeal, Recipe,
} from "@/app/lib/types";
import { COMMON_SERVING_UNITS } from "@/app/lib/types";
import { scaleNutrition } from "@/app/lib/nutrition";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { emoji: "🥩", label: "Viandes",         query: "viande bœuf poulet porc" },
  { emoji: "🐟", label: "Poissons",        query: "poisson saumon thon" },
  { emoji: "🥚", label: "Œufs",            query: "œuf" },
  { emoji: "🧀", label: "Laitages",        query: "lait yaourt fromage" },
  { emoji: "🌾", label: "Céréales",        query: "riz pâtes avoine quinoa" },
  { emoji: "🥖", label: "Pain",            query: "pain baguette brioche" },
  { emoji: "🥦", label: "Légumes",         query: "carotte brocoli courgette tomate" },
  { emoji: "🍎", label: "Fruits",          query: "pomme banane fraise raisin" },
  { emoji: "🫘", label: "Légumineuses",    query: "lentilles pois chiche haricots" },
  { emoji: "🥜", label: "Noix",            query: "amandes noix noisettes" },
  { emoji: "🧈", label: "Corps gras",      query: "beurre huile" },
  { emoji: "🍫", label: "Sucreries",       query: "chocolat gâteau biscuit" },
  { emoji: "🥤", label: "Boissons",        query: "jus soda café thé" },
  { emoji: "🍿", label: "Snacks",          query: "chips crackers barre céréales" },
  { emoji: "🍲", label: "Plats cuisinés",  query: "plat cuisiné lasagne pizza" },
  { emoji: "🌿", label: "Épices",          query: "herbe épice sel ail" },
];

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  ciqual: { label: "Ciqual ANSES",    color: "var(--fiber)" },
  off:    { label: "Open Food Facts", color: "var(--steps)" },
  usda:   { label: "USDA",            color: "var(--carbs)" },
  custom: { label: "Personnel",       color: "var(--protein)" },
  recipe: { label: "Recette",         color: "var(--calories)" },
};

const HUNGER_ICONS = [
  { level: 1 as HungerLevel, Icon: SmileySad,   label: "Pas faim" },
  { level: 2 as HungerLevel, Icon: SmileyMeh,   label: "Peu faim" },
  { level: 3 as HungerLevel, Icon: Smiley,      label: "Modéré" },
  { level: 4 as HungerLevel, Icon: SmileyBlank, label: "Faim" },
  { level: 5 as HungerLevel, Icon: SmileyXEyes, label: "Très faim" },
];

const MEAL_ICONS = ["🍽️","☕","🥗","🍱","🍜","🥙","🥪","🍛","🥘","🫕"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNutritionPer100g(food: FoodSearchResult): FoodNutrition {
  return scaleNutrition(food.nutrition, 100 / food.servingSizeG * food.servingSizeG);
}

function getServingOptions(food: FoodSearchResult): ServingOption[] {
  return food.servingOptions?.length ? food.servingOptions : COMMON_SERVING_UNITS;
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
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<ServingOption | null>(null);
  const [customQty, setCustomQty]   = useState("1");
  const [useCustomG, setUseCustomG] = useState(false);
  const [customGrams, setCustomGrams] = useState("100");
  const [notes, setNotes]   = useState("");
  const [hunger, setHunger] = useState<HungerLevel | null>(null);
  const [adding, setAdding] = useState(false);
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null);

  // Repas state
  const [savedMeals, setSavedMeals]       = useState<SavedMeal[]>([]);
  const [loadingMeals, setLoadingMeals]   = useState(false);
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

  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTab("aliments"); setStep("browse");
      setQuery(""); setResults([]); setSelected(null);
      setSelectedUnit(null); setCustomQty("1"); setUseCustomG(false); setCustomGrams("100");
      setNotes(""); setHunger(null);
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
    setResults([]);
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
    if (!value.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/food/search?q=${encodeURIComponent(value)}&lang=${lang}`);
        const json = await res.json() as { results: FoodSearchResult[] };
        setResults(json.results ?? []);
      } finally { setSearching(false); }
    }, 320);
  };

  const selectFood = (food: FoodSearchResult) => {
    setSelected(food);
    const opts = getServingOptions(food);
    setSelectedUnit(opts.find((o) => o.isDefault) ?? opts[0]);
    setCustomQty("1"); setUseCustomG(false);
    setCustomGrams(String(food.servingSizeG));
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
      await fetch("/api/log", {
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
            nutrition, notes: notes || undefined, hunger: hunger ?? undefined,
          },
        }),
      });
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
      await fetch("/api/log", {
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
      setStep("browse"); setTab("repas");
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
      await fetch("/api/log", {
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
      onAdded({ name: selectedRecipe.name, calories: Math.round(nutrition.calories) });
      onClose();
    } finally { setAddingRecipe(false); }
  };

  const cn = computedNutrition();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl overflow-hidden"
            style={{
              background: "rgba(13,13,17,0.97)",
              border: "1px solid var(--border-strong)", borderBottom: "none",
              backdropFilter: "blur(24px)", maxHeight: "92vh",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-8 h-1 rounded-full" style={{ background: "var(--border-strong)" }} />
            </div>

            {/* Header */}
            <div className="px-4 pb-0 pt-2 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                {(step === "configure" || step === "configure-recipe" || step === "save-meal") && (
                  <button onClick={() => setStep("browse")} className="btn-icon flex-shrink-0">
                    <ArrowLeft size={13} />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  {step === "browse" && tab === "aliments" && (
                    <div className="relative">
                      {searching
                        ? <Spinner size={13} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--text-muted)" }} />
                        : <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                      }
                      <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => doSearch(e.target.value)}
                        placeholder="Rechercher un aliment…"
                        className="input pl-9 text-[13.5px]"
                      />
                    </div>
                  )}
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
                  {step === "browse" && tab !== "aliments" && (
                    <p className="font-semibold text-[15px]" style={{ color: "var(--text-primary)" }}>
                      {tab === "repas" ? "Mes repas" : "Mes recettes"}
                    </p>
                  )}
                </div>
                <button onClick={onClose} className="btn-icon flex-shrink-0"><X size={13} /></button>
              </div>

              {/* Tab bar — only shown on browse step */}
              {step === "browse" && (
                <div className="flex gap-1 p-1 rounded-xl mb-0"
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
              )}
            </div>

            {/* Divider */}
            <div className="h-px flex-shrink-0 mt-3" style={{ background: "var(--border)" }} />

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <AnimatePresence mode="wait">

                {/* ── ALIMENTS browse ── */}
                {step === "browse" && tab === "aliments" && (
                  <motion.div key="aliments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }} className="px-4 py-3">
                    {!query && (
                      <>
                        <p className="label-xs mb-3">Catégories</p>
                        <div className="grid grid-cols-4 gap-2">
                          {CATEGORIES.map((cat, i) => (
                            <motion.button key={cat.emoji}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.15, delay: i * 0.018 }}
                              onClick={() => browseCategory(cat)}
                              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <span className="text-[22px] leading-none">{cat.emoji}</span>
                              <span className="text-[10px] font-medium leading-tight text-center" style={{ color: "var(--text-muted)" }}>{cat.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </>
                    )}
                    {query && !searching && results.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-14">
                        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun résultat pour &ldquo;{query}&rdquo;</p>
                      </div>
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
                            <button onClick={() => selectFood(r)} className="flex-1 flex flex-col gap-1.5 p-3 text-left min-w-0">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {r.brand && <span className="text-[11px] truncate max-w-[90px]" style={{ color: "var(--text-muted)" }}>{r.brand}</span>}
                                    {r.brand && <span style={{ color: "var(--border-strong)" }}>·</span>}
                                    <span className="text-[10px]" style={{ color: badge?.color ?? "var(--text-muted)" }}>{badge?.label}</span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[14px] font-bold tabular-nums leading-tight" style={{ color: "var(--calories)" }}>{r.nutrition.calories}</p>
                                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/{r.servingSizeG}g</p>
                                </div>
                              </div>
                              <MacroPills n={r.nutrition} />
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
                  </motion.div>
                )}

                {/* ── REPAS browse ── */}
                {step === "browse" && tab === "repas" && (
                  <motion.div key="repas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }} className="px-4 py-4">
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
                  </motion.div>
                )}

                {/* ── RECETTES browse ── */}
                {step === "browse" && tab === "recettes" && (
                  <motion.div key="recettes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }} className="px-4 py-4">
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
                  </motion.div>
                )}

                {/* ── CONFIGURE food ── */}
                {step === "configure" && selected && (
                  <motion.div key="configure" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}
                    className="px-4 py-4 space-y-5 pb-8">

                    {/* Source badge */}
                    <div className="flex items-center gap-2">
                      <span className="badge"
                        style={{ borderColor: `${SOURCE_BADGE[selected.source]?.color}40`, color: SOURCE_BADGE[selected.source]?.color }}>
                        {SOURCE_BADGE[selected.source]?.label ?? selected.source}
                      </span>
                      {selected.category && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{selected.category}</span>}
                    </div>

                    {/* Serving */}
                    <div>
                      <p className="label-xs mb-2">Portion</p>
                      {!useCustomG ? (
                        <>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {getServingOptions(selected).map((opt) => (
                              <button key={opt.label} onClick={() => setSelectedUnit(opt)}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
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
                      <div className="p-3 rounded-xl space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                            {Math.round(cn.calories)} kcal
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>pour {Math.round(effectiveGrams())}g</span>
                        </div>
                        <MacroPills n={cn} />
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <p className="label-xs mb-1.5">Note (optionnel)</p>
                      <input value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex : avec vinaigrette…"
                        className="input text-[13px]" />
                    </div>

                    {/* Hunger */}
                    <div>
                      <p className="label-xs mb-2">Niveau de faim</p>
                      <div className="flex gap-2">
                        {HUNGER_ICONS.map(({ level, Icon, label }) => (
                          <button key={level} onClick={() => setHunger(hunger === level ? null : level)}
                            title={label}
                            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all"
                            style={{
                              background: hunger === level ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${hunger === level ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                            }}>
                            <Icon size={20} weight={hunger === level ? "fill" : "regular"}
                              style={{ color: hunger === level ? "var(--protein)" : "var(--text-muted)" }} />
                            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                          </button>
                        ))}
                      </div>
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
                  </motion.div>
                )}

                {/* ── SAVE MEAL ── */}
                {step === "save-meal" && selected && (
                  <motion.div key="save-meal" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                    className="px-4 py-4 space-y-4 pb-8">

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
                  </motion.div>
                )}

                {/* ── CONFIGURE recipe ── */}
                {step === "configure-recipe" && selectedRecipe && (
                  <motion.div key="configure-recipe" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                    className="px-4 py-4 space-y-5 pb-8">

                    {/* Ingredients */}
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

                    {/* Servings */}
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

                    {/* Nutrition preview */}
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
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
