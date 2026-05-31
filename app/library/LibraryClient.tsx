"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconSearch, IconX, IconLoader2, IconChevronLeft, IconPlus, IconCalendar,
  IconCheck,
} from "@tabler/icons-react";
import type { FoodNutrition, FoodSearchResult, MealType } from "@/app/lib/types";
import { COMMON_SERVING_UNITS } from "@/app/lib/types";
import { scaleNutrition } from "@/app/lib/nutrition";
import { format } from "date-fns";

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "viandes",      emoji: "🥩", label: "Viandes",          query: "viande bœuf poulet porc agneau" },
  { id: "poissons",     emoji: "🐟", label: "Poissons",         query: "poisson saumon thon cabillaud sardine" },
  { id: "oeufs",        emoji: "🥚", label: "Œufs",             query: "œuf" },
  { id: "laitages",     emoji: "🧀", label: "Laitages",         query: "lait yaourt fromage crème" },
  { id: "cereales",     emoji: "🌾", label: "Céréales",         query: "riz pâtes avoine quinoa blé" },
  { id: "pain",         emoji: "🥖", label: "Pain & viennois",  query: "pain baguette brioche croissant" },
  { id: "legumes",      emoji: "🥦", label: "Légumes",          query: "carotte brocoli courgette épinard tomate" },
  { id: "fruits",       emoji: "🍎", label: "Fruits",           query: "pomme banane fraise raisin mangue" },
  { id: "legumineuses", emoji: "🫘", label: "Légumineuses",     query: "lentilles pois chiche haricots fèves" },
  { id: "noix",         emoji: "🥜", label: "Noix & graines",   query: "amandes noix noisettes graines chia" },
  { id: "matieres",     emoji: "🧈", label: "Corps gras",       query: "beurre huile margarine" },
  { id: "sucreries",    emoji: "🍫", label: "Sucreries",        query: "chocolat gâteau biscuit confiture miel" },
  { id: "boissons",     emoji: "🥤", label: "Boissons",         query: "jus soda thé café boisson" },
  { id: "plats",        emoji: "🍲", label: "Plats cuisinés",   query: "plat cuisiné lasagne pizza quiche" },
  { id: "epices",       emoji: "🌿", label: "Herbes & épices",  query: "herbe épice sel poivre ail" },
  { id: "snacks",       emoji: "🍿", label: "Snacks",           query: "chips crackers popcorn barre céréales" },
];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Petit-déjeuner",
  lunch:     "Déjeuner",
  dinner:    "Dîner",
  snacks:    "Collation",
};

const SOURCE_COLOR: Record<string, string> = {
  ciqual: "var(--fiber)",
  off:    "var(--steps)",
  usda:   "var(--carbs)",
  custom: "var(--protein)",
};
const SOURCE_LABEL: Record<string, string> = {
  ciqual: "Ciqual",
  off:    "Open Food Facts",
  usda:   "USDA",
  custom: "Personnel",
};

// ─── Nutrition helpers ────────────────────────────────────────────────────────

function per100g(food: FoodSearchResult): FoodNutrition {
  return scaleNutrition(food.nutrition, 100 / food.servingSizeG * food.servingSizeG);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NutritionRow({ label, value, unit, color }: { label: string; value: number; unit: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-[12px] font-medium tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>
        {value}{unit}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LibraryClient() {
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<FoodSearchResult[]>([]);
  const [searching, setSearching]   = useState(false);
  const [activeCat, setActiveCat]   = useState<string | null>(null);
  const [selected, setSelected]     = useState<FoodSearchResult | null>(null);

  // Serving state
  const [servingUnit, setServingUnit] = useState(COMMON_SERVING_UNITS[0]);
  const [qty, setQty]                 = useState("1");

  // Add to log
  const [addOpen, setAddOpen]   = useState(false);
  const [meal, setMeal]         = useState<MealType>("lunch");
  const [logDate, setLogDate]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [adding, setAdding]     = useState(false);
  const [added, setAdded]       = useState(false);

  const debounce = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback((q: string, catId?: string) => {
    setQuery(q);
    setActiveCat(catId ?? null);
    setSelected(null);
    if (!q.trim()) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/food/search?q=${encodeURIComponent(q)}&lang=fr`);
        const json = await res.json() as { results: FoodSearchResult[] };
        setResults(json.results ?? []);
      } finally { setSearching(false); }
    }, 300);
  }, []);

  const selectFood = (food: FoodSearchResult) => {
    setSelected(food);
    const def = food.servingOptions?.find((o) => o.isDefault) ?? COMMON_SERVING_UNITS[0];
    setServingUnit(def);
    setQty("1");
    setAdded(false);
    setAddOpen(false);
  };

  const grams = Math.max(1, (parseFloat(qty) || 1) * servingUnit.grams);
  const scaled = selected ? scaleNutrition(per100g(selected), grams) : null;

  const handleAdd = async () => {
    if (!selected || !scaled) return;
    setAdding(true);
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: logDate,
        entry: {
          meal,
          foodId:       selected.id,
          source:       selected.source,
          name:         selected.name,
          brand:        selected.brand,
          servingLabel: `${qty} ${servingUnit.label} (${grams}g)`,
          servingGrams: grams,
          servingQty:   parseFloat(qty) || 1,
          servingUnit:  servingUnit.label,
          nutrition:    scaled,
        },
      }),
    });
    setAdding(false);
    setAdded(true);
    setAddOpen(false);
    setTimeout(() => setAdded(false), 2000);
  };

  const showResults = query.trim().length > 0;
  const showCategories = !showResults;

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />

      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-none md:pr-8">
        {/* Header */}
        <div className="mb-5">
          <p className="label-xs mb-0.5">Base alimentaire</p>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Bibliothèque
          </h1>
        </div>

        <div className="md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">
          {/* ── Left panel ── */}
          <div>
            {/* Search bar */}
            <div className="relative mb-5">
              {searching
                ? <IconLoader2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--text-muted)" }} />
                : <IconSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              }
              <input
                value={query}
                onChange={(e) => doSearch(e.target.value)}
                placeholder="Rechercher un aliment…"
                className="input pl-10 text-[14px]"
                style={{ height: "44px" }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setResults([]); setActiveCat(null); }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 btn-icon"
                >
                  <IconX size={12} />
                </button>
              )}
            </div>

            {/* Categories grid */}
            <AnimatePresence mode="wait">
              {showCategories && (
                <motion.div
                  key="cats"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="label-xs mb-3">Catégories</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {CATEGORIES.map((cat, i) => (
                      <motion.button
                        key={cat.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: i * 0.025 }}
                        onClick={() => doSearch(cat.query, cat.id)}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl text-center transition-all"
                        style={{
                          background: activeCat === cat.id
                            ? "rgba(167,139,250,0.12)"
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${activeCat === cat.id ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                        }}
                        whileHover={{ scale: 1.03, background: "rgba(255,255,255,0.06)" }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <span className="text-[26px] leading-none">{cat.emoji}</span>
                        <span className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
                          {cat.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Results list */}
              {showResults && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeCat && (
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => { setQuery(""); setResults([]); setActiveCat(null); }}
                        className="btn-icon"
                      >
                        <IconChevronLeft size={13} />
                      </button>
                      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        {CATEGORIES.find((c) => c.id === activeCat)?.emoji}{" "}
                        {CATEGORIES.find((c) => c.id === activeCat)?.label}
                      </span>
                    </div>
                  )}

                  {searching && results.length === 0 && (
                    <div className="flex justify-center py-12">
                      <IconLoader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                    </div>
                  )}

                  {!searching && results.length === 0 && (
                    <p className="text-center py-12 text-[13px]" style={{ color: "var(--text-muted)" }}>
                      Aucun résultat pour &ldquo;{query}&rdquo;
                    </p>
                  )}

                  <div className="space-y-1.5">
                    {results.map((food, i) => {
                      const isSelected = selected?.id === food.id;
                      return (
                        <motion.button
                          key={food.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, delay: i * 0.03 }}
                          onClick={() => selectFood(food)}
                          className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                          style={{
                            background: isSelected
                              ? "rgba(167,139,250,0.1)"
                              : "rgba(255,255,255,0.03)",
                            border: `1px solid ${isSelected ? "rgba(167,139,250,0.35)" : "var(--border)"}`,
                          }}
                          whileHover={{ background: isSelected ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.055)" }}
                        >
                          {/* Source dot */}
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: SOURCE_COLOR[food.source] ?? "var(--text-muted)" }}
                          />

                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {food.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {food.brand && (
                                <>
                                  <span className="text-[11px] truncate max-w-[100px]" style={{ color: "var(--text-muted)" }}>
                                    {food.brand}
                                  </span>
                                  <span style={{ color: "var(--border-strong)" }}>·</span>
                                </>
                              )}
                              <span className="text-[10px]" style={{ color: SOURCE_COLOR[food.source] ?? "var(--text-muted)" }}>
                                {SOURCE_LABEL[food.source]}
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
                              {food.nutrition.calories}
                            </p>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/{food.servingSizeG}g</p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right panel — Food detail ── */}
          <AnimatePresence mode="wait">
            {selected && scaled && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.22 }}
                className="mt-6 md:mt-0 md:sticky md:top-6"
              >
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-strong)" }}
                >
                  {/* Food header */}
                  <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-[15px] leading-snug" style={{ color: "var(--text-primary)" }}>
                          {selected.name}
                        </h2>
                        {selected.brand && (
                          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{selected.brand}</p>
                        )}
                      </div>
                      <span
                        className="badge flex-shrink-0 mt-0.5"
                        style={{ color: SOURCE_COLOR[selected.source], borderColor: `${SOURCE_COLOR[selected.source]}40` }}
                      >
                        {SOURCE_LABEL[selected.source]}
                      </span>
                    </div>
                  </div>

                  {/* Serving selector */}
                  <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
                    <p className="label-xs mb-2">Portion</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(selected.servingOptions ?? COMMON_SERVING_UNITS).slice(0, 8).map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => setServingUnit(opt)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                          style={{
                            background: servingUnit.label === opt.label ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${servingUnit.label === opt.label ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                            color: servingUnit.label === opt.label ? "var(--protein)" : "var(--text-secondary)",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="label-xs block mb-1">Quantité</label>
                        <input
                          type="number" min="0.1" step="0.5"
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                          className="input"
                        />
                      </div>
                      <div className="pt-5 text-right">
                        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{grams}g</p>
                      </div>
                    </div>
                  </div>

                  {/* Macros */}
                  <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "kcal",  value: scaled.calories,  color: "var(--calories)" },
                        { label: "Prot.", value: `${scaled.proteinG}g`, color: "var(--protein)" },
                        { label: "Gluc.", value: `${scaled.carbsG}g`,   color: "var(--carbs)" },
                        { label: "Lip.",  value: `${scaled.fatG}g`,     color: "var(--fat)" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="glass rounded-xl p-2.5 text-center">
                          <p className="text-[14px] font-bold tabular-nums" style={{ color }}>{value}</p>
                          <p className="label-xs mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Full nutrition table */}
                  <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
                    <p className="label-xs mb-2">Détail — {grams}g</p>
                    <div>
                      {scaled.fiberG        != null && <NutritionRow label="Fibres"         value={scaled.fiberG}        unit="g"  color="var(--fiber)" />}
                      {scaled.sugarG        != null && <NutritionRow label="Sucres"         value={scaled.sugarG}        unit="g"  />}
                      {scaled.saturatedFatG != null && <NutritionRow label="AG saturés"     value={scaled.saturatedFatG} unit="g"  />}
                      {scaled.sodiumMg      != null && <NutritionRow label="Sodium"         value={scaled.sodiumMg}      unit="mg" />}
                      {scaled.cholesterolMg != null && <NutritionRow label="Cholestérol"    value={scaled.cholesterolMg} unit="mg" />}
                      {scaled.potassiumMg   != null && <NutritionRow label="Potassium"      value={scaled.potassiumMg}   unit="mg" />}
                      {scaled.calciumMg     != null && <NutritionRow label="Calcium"        value={scaled.calciumMg}     unit="mg" />}
                      {scaled.magneziumMg   != null && <NutritionRow label="Magnésium"      value={scaled.magneziumMg}   unit="mg" />}
                      {scaled.ironMg        != null && <NutritionRow label="Fer"            value={scaled.ironMg}        unit="mg" />}
                      {scaled.zincMg        != null && <NutritionRow label="Zinc"           value={scaled.zincMg}        unit="mg" />}
                      {scaled.vitaminCMg    != null && <NutritionRow label="Vit. C"         value={scaled.vitaminCMg}    unit="mg" color="var(--fiber)" />}
                      {scaled.vitaminDUg    != null && <NutritionRow label="Vit. D"         value={scaled.vitaminDUg}    unit="µg" />}
                      {scaled.vitaminB12Ug  != null && <NutritionRow label="Vit. B12"       value={scaled.vitaminB12Ug}  unit="µg" />}
                      {scaled.vitaminAUg    != null && <NutritionRow label="Vit. A"         value={scaled.vitaminAUg}    unit="µg" />}
                      {scaled.waterG        != null && <NutritionRow label="Eau"            value={scaled.waterG}        unit="g"  />}
                      {scaled.alcoholG      != null && <NutritionRow label="Alcool"         value={scaled.alcoholG}      unit="g"  />}
                    </div>
                  </div>

                  {/* Add to log */}
                  <div className="p-4">
                    {!addOpen ? (
                      <button
                        onClick={() => setAddOpen(true)}
                        className="btn btn-primary w-full gap-2"
                        style={{ height: "42px" }}
                      >
                        {added ? (
                          <><IconCheck size={14} /> Ajouté !</>
                        ) : (
                          <><IconPlus size={14} /> Ajouter au journal</>
                        )}
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-3"
                      >
                        {/* Date picker */}
                        <div>
                          <label className="label-xs block mb-1.5 flex items-center gap-1.5">
                            <IconCalendar size={11} /> Date
                          </label>
                          <input
                            type="date"
                            value={logDate}
                            onChange={(e) => setLogDate(e.target.value)}
                            className="input text-[13px]"
                          />
                        </div>

                        {/* Meal picker */}
                        <div>
                          <p className="label-xs mb-1.5">Repas</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(["breakfast","lunch","dinner","snacks"] as MealType[]).map((m) => (
                              <button
                                key={m}
                                onClick={() => setMeal(m)}
                                className="py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                                style={{
                                  background: meal === m ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${meal === m ? "rgba(249,115,22,0.5)" : "var(--border)"}`,
                                  color: meal === m ? "var(--calories)" : "var(--text-secondary)",
                                }}
                              >
                                {MEAL_LABELS[m]}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => setAddOpen(false)} className="btn btn-ghost flex-1 text-[12px]">
                            Annuler
                          </button>
                          <button onClick={handleAdd} disabled={adding} className="btn btn-primary flex-1 gap-1.5 text-[12px]">
                            {adding
                              ? <IconLoader2 size={12} className="animate-spin" />
                              : <><IconCheck size={12} /> Confirmer</>
                            }
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
