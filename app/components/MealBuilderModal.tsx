"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MagnifyingGlass, Plus, Spinner, Trash, Check,
} from "@phosphor-icons/react";
import type {
  FoodNutrition, FoodSearchResult, FoodSource, Lang, ServingOption,
} from "@/app/lib/types";
import { COMMON_SERVING_UNITS } from "@/app/lib/types";
import { scaleNutrition } from "@/app/lib/nutrition";

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_ICONS = ["🍽️","☕","🥗","🍱","🍜","🥙","🥪","🍛","🥘","🫕","🥞","🍳","🌯","🫔","🌮","🍔","🥩","🐟"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface MealItem {
  foodId:       string;
  source:       FoodSource;
  name:         string;
  brand?:       string;
  servingLabel: string;
  servingGrams: number;
  nutrition:    FoodNutrition;
}

interface Props {
  open:    boolean;
  lang?:   Lang;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getServingOptions(food: FoodSearchResult): ServingOption[] {
  return food.servingOptions?.length ? food.servingOptions : COMMON_SERVING_UNITS;
}

function nutritionForGrams(food: FoodSearchResult, grams: number): FoodNutrition {
  return scaleNutrition(food.nutrition, (grams / food.servingSizeG) * 100);
}

function sumNutrition(items: MealItem[]): FoodNutrition {
  return items.reduce<FoodNutrition>(
    (acc, item) => ({
      calories: acc.calories + item.nutrition.calories,
      proteinG: acc.proteinG + item.nutrition.proteinG,
      carbsG:   acc.carbsG   + item.nutrition.carbsG,
      fatG:     acc.fatG     + item.nutrition.fatG,
      fiberG:   acc.fiberG   + item.nutrition.fiberG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MealBuilderModal({ open, lang = "fr", onClose, onSaved }: Props) {
  const [mounted, setMounted] = useState(false);

  // Meal
  const [mealName, setMealName] = useState("");
  const [mealIcon, setMealIcon] = useState("🍽️");
  const [items,    setItems]    = useState<MealItem[]>([]);
  const [saving,   setSaving]   = useState(false);

  // Search
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Inline configure (after tapping a result)
  const [editingFood, setEditingFood] = useState<FoodSearchResult | null>(null);
  const [editingUnit, setEditingUnit] = useState<ServingOption | null>(null);
  const [editingQty,  setEditingQty]  = useState("1");

  const searchRef   = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      setMealName(""); setMealIcon("🍽️"); setItems([]);
      setQuery(""); setResults([]); setEditingFood(null);
      setTimeout(() => searchRef.current?.focus(), 120);
    }
  }, [open]);

  const doSearch = useCallback((value: string) => {
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
  }, [lang]);

  const selectFood = (food: FoodSearchResult) => {
    const opts = getServingOptions(food);
    setEditingFood(food);
    setEditingUnit(opts.find((o) => o.isDefault) ?? opts[0]);
    setEditingQty("1");
    setResults([]);
    setQuery("");
  };

  const effectiveGrams = () =>
    Math.max(1, (parseFloat(editingQty) || 1) * (editingUnit?.grams ?? 100));

  const addFoodToMeal = () => {
    if (!editingFood) return;
    const grams = effectiveGrams();
    setItems((prev) => [
      ...prev,
      {
        foodId:       editingFood.id,
        source:       editingFood.source,
        name:         editingFood.name,
        brand:        editingFood.brand,
        servingLabel: `${editingQty} × ${editingUnit?.label ?? "portion"} (${grams}g)`,
        servingGrams: grams,
        nutrition:    nutritionForGrams(editingFood, grams),
      },
    ]);
    setEditingFood(null);
    setTimeout(() => searchRef.current?.focus(), 80);
  };

  const handleSave = async () => {
    if (!mealName.trim() || items.length === 0) return;
    setSaving(true);
    try {
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    mealName.trim(),
          icon:    mealIcon,
          entries: items,
        }),
      });
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  const cycleIcon = () => {
    const idx = MEAL_ICONS.indexOf(mealIcon);
    setMealIcon(MEAL_ICONS[(idx + 1) % MEAL_ICONS.length]);
  };

  const totals = sumNutrition(items);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mb-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0"
            style={{ zIndex: 70, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="mb-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
            className="fixed inset-x-0 bottom-0 flex flex-col rounded-t-2xl"
            style={{
              zIndex: 80,
              background: "rgba(13,13,17,0.98)",
              border: "1px solid var(--border-strong)", borderBottom: "none",
              backdropFilter: "blur(24px)",
              maxHeight: "94vh",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-8 h-1 rounded-full" style={{ background: "var(--border-strong)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <button onClick={onClose} className="btn-icon flex-shrink-0"><X size={13} /></button>
              <p className="flex-1 font-semibold text-[15px]" style={{ color: "var(--text-primary)" }}>
                Créer un repas
              </p>
              <button
                onClick={handleSave}
                disabled={saving || !mealName.trim() || items.length === 0}
                className="btn btn-primary px-3 py-1.5 text-[12px] gap-1.5"
              >
                {saving
                  ? <Spinner size={12} className="animate-spin" />
                  : <Check size={12} weight="bold" />}
                Sauvegarder
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">

              {/* ── Meal meta ── */}
              <div className="px-4 pt-4 pb-3 space-y-3">
                <div className="flex gap-2 items-center">
                  <button onClick={cycleIcon}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] flex-shrink-0 transition-transform active:scale-95"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
                    {mealIcon}
                  </button>
                  <input
                    value={mealName}
                    onChange={(e) => setMealName(e.target.value)}
                    placeholder="Nom du repas…"
                    className="input flex-1 text-[14px] font-medium"
                    maxLength={40}
                  />
                </div>

                {items.length > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
                      {Math.round(totals.calories)} kcal
                    </span>
                    <span style={{ color: "var(--border-strong)" }}>·</span>
                    {[
                      { l: "P", v: totals.proteinG, c: "var(--protein)" },
                      { l: "G", v: totals.carbsG,   c: "var(--carbs)" },
                      { l: "L", v: totals.fatG,      c: "var(--fat)" },
                    ].map(({ l, v, c }) => (
                      <span key={l} className="text-[12px] tabular-nums">
                        <span className="font-semibold" style={{ color: c }}>{l} </span>
                        <span style={{ color: "var(--text-secondary)" }}>{Math.round(v)}g</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Added items ── */}
              {items.length > 0 && (
                <div className="px-4 pb-3">
                  <p className="label-xs mb-2">Aliments ajoutés ({items.length})</p>
                  <div className="space-y-1.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {item.name}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {item.servingLabel}
                            <span className="ml-1.5 font-medium" style={{ color: "var(--calories)" }}>
                              {Math.round(item.nutrition.calories)} kcal
                            </span>
                          </p>
                        </div>
                        <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="btn-icon w-7 h-7 flex-shrink-0"
                          style={{ color: "#f87171" }}>
                          <Trash size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px mx-4 mb-3" style={{ background: "var(--border)" }} />

              {/* ── Inline configure ── */}
              {editingFood ? (
                <div className="px-4 pb-6 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {editingFood.name}
                      </p>
                      {editingFood.brand && (
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{editingFood.brand}</p>
                      )}
                    </div>
                    <button onClick={() => setEditingFood(null)} className="btn-icon w-7 h-7 flex-shrink-0">
                      <X size={12} />
                    </button>
                  </div>

                  {/* Serving chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {getServingOptions(editingFood).map((opt) => (
                      <button key={opt.label} onClick={() => setEditingUnit(opt)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors"
                        style={{
                          background: editingUnit?.label === opt.label
                            ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${editingUnit?.label === opt.label
                            ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                          color: editingUnit?.label === opt.label
                            ? "var(--protein)" : "var(--text-secondary)",
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Qty stepper */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingQty((v) => String(Math.max(0.5, (parseFloat(v) || 1) - 0.5)))}
                        className="btn-icon w-8 h-8 text-lg">−
                      </button>
                      <input type="number" value={editingQty} min="0.5" step="0.5"
                        onChange={(e) => setEditingQty(e.target.value)}
                        className="input text-center w-16 tabular-nums" />
                      <button
                        onClick={() => setEditingQty((v) => String((parseFloat(v) || 1) + 0.5))}
                        className="btn-icon w-8 h-8 text-lg">+
                      </button>
                    </div>
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      = {Math.round(effectiveGrams())}g ·{" "}
                      <span style={{ color: "var(--calories)" }}>
                        {Math.round(nutritionForGrams(editingFood, effectiveGrams()).calories)} kcal
                      </span>
                    </span>
                  </div>

                  <button onClick={addFoodToMeal} className="btn btn-primary w-full gap-2">
                    <Plus size={14} weight="bold" />
                    Ajouter au repas
                  </button>
                </div>
              ) : (
                /* ── Food search ── */
                <div className="px-4 pb-6">
                  <p className="label-xs mb-2">Ajouter un aliment</p>
                  <div className="relative mb-3">
                    {searching
                      ? <Spinner size={13} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin"
                          style={{ color: "var(--text-muted)" }} />
                      : <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--text-muted)" }} />
                    }
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => doSearch(e.target.value)}
                      placeholder="Rechercher un aliment…"
                      className="input pl-9 text-[13px]"
                    />
                  </div>

                  {results.length > 0 && (
                    <div className="space-y-1">
                      {results.slice(0, 12).map((r) => (
                        <button key={r.id} onClick={() => selectFood(r)}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-colors"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {r.name}
                            </p>
                            {r.brand && (
                              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{r.brand}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
                              {r.nutrition.calories}
                            </p>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/{r.servingSizeG}g</p>
                          </div>
                          <Plus size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        </button>
                      ))}
                    </div>
                  )}

                  {!query && items.length === 0 && (
                    <p className="text-[12.5px] text-center py-4" style={{ color: "var(--text-muted)" }}>
                      Cherchez des aliments pour composer votre repas.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
