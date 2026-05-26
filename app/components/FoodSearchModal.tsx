"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MagnifyingGlass, Plus, ArrowLeft, Spinner,
  Smiley, SmileyMeh, SmileySad, SmileyBlank, SmileyXEyes,
} from "@phosphor-icons/react";
import type { FoodNutrition, FoodSearchResult, HungerLevel, MealType, Lang, ServingOption } from "@/app/lib/types";
import { COMMON_SERVING_UNITS } from "@/app/lib/types";
import { scaleNutrition } from "@/app/lib/nutrition";

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

interface Props {
  open:    boolean;
  meal:    MealType;
  date:    string;
  lang?:   Lang;
  onClose: () => void;
  onAdded: () => void;
}

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

type Step = "search" | "configure" | "browse";

function getNutritionPer100g(food: FoodSearchResult): FoodNutrition {
  const ratio = 100 / food.servingSizeG;
  return scaleNutrition(food.nutrition, food.servingSizeG * ratio);
}

function getServingOptions(food: FoodSearchResult): ServingOption[] {
  if (food.servingOptions && food.servingOptions.length > 0) return food.servingOptions;
  return COMMON_SERVING_UNITS;
}

export default function FoodSearchModal({ open, meal, date, lang = "fr", onClose, onAdded }: Props) {
  const [step, setStep]         = useState<Step>("search");
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<FoodSearchResult[]>([]);
  const [searching, setSearching]   = useState(false);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);

  // Serving state
  const [selectedUnit, setSelectedUnit] = useState<ServingOption | null>(null);
  const [customQty, setCustomQty]       = useState("1");  // qty of the selected unit
  const [useCustomG, setUseCustomG]     = useState(false);
  const [customGrams, setCustomGrams]   = useState("100");

  // Notes + hunger
  const [notes, setNotes]   = useState("");
  const [hunger, setHunger] = useState<HungerLevel | null>(null);

  const [adding, setAdding] = useState(false);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (open) {
      setStep("search"); setQuery(""); setResults([]); setSelected(null);
      setSelectedUnit(null); setCustomQty("1"); setUseCustomG(false); setCustomGrams("100");
      setNotes(""); setHunger(null);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  const browseCategory = (cat: typeof CATEGORIES[number]) => {
    setQuery(cat.label);
    setStep("search");
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/food/search?q=${encodeURIComponent(cat.query)}&lang=${lang}`);
        const json = await res.json() as { results: FoodSearchResult[] };
        setResults(json.results ?? []);
      } finally { setSearching(false); }
    }, 50);
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
    const def  = opts.find((o) => o.isDefault) ?? opts[0];
    setSelectedUnit(def);
    setCustomQty("1");
    setUseCustomG(false);
    setCustomGrams(String(food.servingSizeG));
    setStep("configure");
  };

  const effectiveGrams = (): number => {
    if (useCustomG) return Math.max(1, parseFloat(customGrams) || 0);
    if (!selectedUnit) return 100;
    return Math.max(1, (parseFloat(customQty) || 1) * selectedUnit.grams);
  };

  const computedNutrition = (): FoodNutrition | null => {
    if (!selected) return null;
    const per100g = getNutritionPer100g(selected);
    return scaleNutrition(per100g, effectiveGrams());
  };

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    const grams  = effectiveGrams();
    const per100g = getNutritionPer100g(selected);
    const nutrition = scaleNutrition(per100g, grams);
    const servingLabel = useCustomG
      ? `${grams}g`
      : `${customQty} ${selectedUnit?.label ?? "portion"} (${grams}g)`;

    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        entry: {
          meal,
          foodId:       selected.id,
          source:       selected.source,
          name:         selected.name,
          brand:        selected.brand,
          servingLabel,
          servingGrams: grams,
          servingQty:   useCustomG ? grams : parseFloat(customQty) || 1,
          servingUnit:  useCustomG ? "g" : (selectedUnit?.label ?? "g"),
          nutrition,
          notes:        notes || undefined,
          hunger:       hunger ?? undefined,
        },
      }),
    });
    setAdding(false);
    onAdded();
    onClose();
  };

  const cn = computedNutrition();

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

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl overflow-hidden"
            style={{
              background: "rgba(13,13,17,0.97)",
              border: "1px solid var(--border-strong)",
              borderBottom: "none",
              backdropFilter: "blur(24px)",
              maxHeight: "92vh",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-8 h-1 rounded-full" style={{ background: "var(--border-strong)" }} />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 pt-2 flex-shrink-0 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                {step === "configure" && (
                  <button onClick={() => setStep("search")} className="btn-icon flex-shrink-0">
                    <ArrowLeft size={13} />
                  </button>
                )}
                {step === "search" && (
                  <div className="relative flex-1">
                    {searching
                      ? <Spinner size={13} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--text-muted)" }} />
                      : <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    }
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => doSearch(e.target.value)}
                      placeholder={lang === "fr" ? "Rechercher un aliment…" : "Search food…"}
                      className="input pl-9 text-[13.5px]"
                    />
                  </div>
                )}
                {step === "configure" && selected && (
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate" style={{ color: "var(--text-primary)" }}>{selected.name}</p>
                    {selected.brand && <p className="text-[11px] t-secondary truncate">{selected.brand}</p>}
                  </div>
                )}
                <button onClick={onClose} className="btn-icon flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <AnimatePresence mode="wait">
                {step === "search" ? (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                    className="px-4 py-3"
                  >
                    {!query && (
                      <div>
                        <p className="label-xs mb-3">Catégories</p>
                        <div className="grid grid-cols-4 gap-2">
                          {CATEGORIES.map((cat, i) => (
                            <motion.button
                              key={cat.emoji}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.15, delay: i * 0.02 }}
                              onClick={() => browseCategory(cat)}
                              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                              whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.07)" }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <span className="text-[22px] leading-none">{cat.emoji}</span>
                              <span className="text-[10px] font-medium leading-tight text-center" style={{ color: "var(--text-muted)" }}>
                                {cat.label}
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                    {query && !searching && results.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-14">
                        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                          Aucun résultat pour &ldquo;{query}&rdquo;
                        </p>
                      </div>
                    )}
                    <div className="space-y-1">
                      {results.map((r) => {
                        const badge = SOURCE_BADGE[r.source];
                        return (
                          <motion.button
                            key={r.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => selectFood(r)}
                            className="w-full flex flex-col gap-2 p-3 rounded-xl text-left"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                            whileHover={{ background: "rgba(255,255,255,0.055)" }}
                          >
                            {/* Row 1 — name + calorie */}
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {r.brand && <span className="text-[11px] truncate max-w-[90px]" style={{ color: "var(--text-muted)" }}>{r.brand}</span>}
                                  {r.brand && <span style={{ color: "var(--border-strong)" }}>·</span>}
                                  <span className="text-[10px]" style={{ color: badge?.color ?? "var(--text-muted)" }}>{badge?.label}</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                                <div>
                                  <p className="text-[14px] font-bold tabular-nums leading-tight" style={{ color: "var(--calories)" }}>{r.nutrition.calories}</p>
                                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/{r.servingSizeG}g</p>
                                </div>
                                <Plus size={12} style={{ color: "var(--text-muted)" }} />
                              </div>
                            </div>
                            {/* Row 2 — macro pills */}
                            <div className="flex gap-2">
                              {[
                                { label: "P", value: r.nutrition.proteinG, color: "var(--protein)" },
                                { label: "G", value: r.nutrition.carbsG,   color: "var(--carbs)" },
                                { label: "L", value: r.nutrition.fatG,     color: "var(--fat)" },
                                { label: "F", value: r.nutrition.fiberG,   color: "var(--fiber)" },
                              ].map(({ label, value, color }) => (
                                <div key={label} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.04)" }}>
                                  <span className="text-[9px] font-bold" style={{ color }}>{label}</span>
                                  <span className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)" }}>{Math.round(value)}g</span>
                                </div>
                              ))}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="configure"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.18 }}
                    className="px-4 py-4 space-y-5 pb-8"
                  >
                    {/* Source badge */}
                    {selected && (
                      <div className="flex items-center gap-2">
                        <span
                          className="badge"
                          style={{
                            borderColor: `${SOURCE_BADGE[selected.source]?.color}40`,
                            color: SOURCE_BADGE[selected.source]?.color,
                          }}
                        >
                          {SOURCE_BADGE[selected.source]?.label ?? selected.source}
                        </span>
                        {selected.category && (
                          <span className="text-[11px] t-muted truncate">{selected.category}</span>
                        )}
                      </div>
                    )}

                    {/* ── Serving unit selector ── */}
                    <div>
                      <p className="label-xs mb-2">Portion</p>

                      {!useCustomG ? (
                        <>
                          {/* Unit chips */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {getServingOptions(selected!).map((opt) => (
                              <button
                                key={opt.label}
                                onClick={() => setSelectedUnit(opt)}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                                style={{
                                  background: selectedUnit?.label === opt.label
                                    ? "rgba(167,139,250,0.15)"
                                    : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${selectedUnit?.label === opt.label ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                                  color: selectedUnit?.label === opt.label ? "var(--protein)" : "var(--text-secondary)",
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* Quantity of selected unit */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="label-xs block mb-1">
                                Quantité
                                {selectedUnit && (
                                  <span className="text-[11px] ml-1 t-muted">
                                    ({selectedUnit.grams}g par {selectedUnit.label})
                                  </span>
                                )}
                              </label>
                              <input
                                type="number" min="0.1" step="0.5"
                                value={customQty}
                                onChange={(e) => setCustomQty(e.target.value)}
                                className="input"
                              />
                            </div>
                            <div className="text-right pt-4">
                              <p className="text-[12px] t-secondary">{effectiveGrams()}g</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="label-xs block mb-1">Grammes exacts</label>
                          <input
                            type="number" min="1" max="5000"
                            value={customGrams}
                            onChange={(e) => setCustomGrams(e.target.value)}
                            className="input"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => setUseCustomG((v) => !v)}
                        className="mt-2 text-[11px] t-muted underline underline-offset-2"
                      >
                        {useCustomG ? "← Choisir une unité" : "Saisir en grammes"}
                      </button>
                    </div>

                    {/* ── Live macro preview ── */}
                    {cn && (
                      <div>
                        <p className="label-xs mb-2">Valeurs nutritionnelles · {effectiveGrams()}g</p>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {[
                            { label: "kcal",  value: cn.calories,  color: "var(--calories)" },
                            { label: "Prot.", value: `${cn.proteinG}g`, color: "var(--protein)" },
                            { label: "Gluc.", value: `${cn.carbsG}g`,   color: "var(--carbs)" },
                            { label: "Lip.",  value: `${cn.fatG}g`,     color: "var(--fat)" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="glass rounded-xl p-2.5 text-center">
                              <p className="text-[15px] font-bold tabular-nums" style={{ color }}>{value}</p>
                              <p className="label-xs mt-0.5">{label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Secondary nutrients */}
                        <div
                          className="rounded-xl p-3 space-y-1.5"
                          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
                        >
                          {[
                            cn.fiberG       != null && { label: "Fibres",          value: `${cn.fiberG}g`,       color: "var(--fiber)" },
                            cn.sugarG       != null && { label: "Sucres",          value: `${cn.sugarG}g`,       color: "var(--carbs)" },
                            cn.saturatedFatG!= null && { label: "AG saturés",      value: `${cn.saturatedFatG}g`,color: "var(--fat)" },
                            cn.sodiumMg     != null && { label: "Sodium",          value: `${cn.sodiumMg}mg`,    color: "var(--text-secondary)" },
                            cn.cholesterolMg!= null && { label: "Cholestérol",     value: `${cn.cholesterolMg}mg`,color: "var(--text-secondary)" },
                            cn.vitaminCMg   != null && { label: "Vitamine C",      value: `${cn.vitaminCMg}mg`,  color: "var(--fiber)" },
                            cn.calciumMg    != null && { label: "Calcium",         value: `${cn.calciumMg}mg`,   color: "var(--text-secondary)" },
                            cn.ironMg       != null && { label: "Fer",             value: `${cn.ironMg}mg`,      color: "var(--text-secondary)" },
                          ].filter(Boolean).map((item) => {
                            if (!item) return null;
                            const { label, value, color } = item as { label: string; value: string; color: string };
                            return (
                              <div key={label} className="flex justify-between text-[11.5px]">
                                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                                <span style={{ color }}>{value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Notes ── */}
                    <div>
                      <label className="label-xs block mb-1.5">Notes (optionnel)</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex. cuisson vapeur, sauce légère…"
                        className="input text-[13px]"
                      />
                    </div>

                    {/* ── Hunger level ── */}
                    <div>
                      <p className="label-xs mb-2">Niveau de faim avant le repas</p>
                      <div className="flex gap-2">
                        {HUNGER_ICONS.map(({ level, Icon, label }) => (
                          <button
                            key={level}
                            onClick={() => setHunger(hunger === level ? null : level)}
                            title={label}
                            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors"
                            style={{
                              background: hunger === level ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${hunger === level ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                            }}
                          >
                            <Icon
                              size={20}
                              style={{ color: hunger === level ? "var(--protein)" : "var(--text-muted)" }}
                            />
                            <span className="text-[9px] t-muted">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Add button ── */}
                    <button
                      onClick={handleAdd}
                      disabled={adding}
                      className="btn btn-primary w-full"
                      style={{ height: "44px", fontSize: "14px" }}
                    >
                      {adding
                        ? <Spinner size={14} className="animate-spin" />
                        : `Ajouter — ${effectiveGrams()}g · ${cn?.calories ?? 0} kcal`
                      }
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
