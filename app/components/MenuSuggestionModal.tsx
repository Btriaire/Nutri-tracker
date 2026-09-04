"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconRefresh, IconLoader2, IconClock, IconFlame, IconChefHat, IconPlus, IconCheck } from "@tabler/icons-react";
import type { MealType, NutritionGoals } from "@/app/lib/types";
import type { MealSuggestion, SuggestionIngredient } from "@/app/api/menu-suggestions/route";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Petit-déjeuner",
  lunch:     "Déjeuner",
  dinner:    "Dîner",
  snacks:    "Collation",
};

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 flex-shrink-0 w-[280px] space-y-3 animate-pulse"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="flex-1 space-y-1">
          <div className="h-3 rounded-full w-3/4" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="h-2 rounded-full w-1/2" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
      </div>
      {[1, 0.85, 0.7, 0.9].map((w, i) => (
        <div key={i} className="h-2 rounded-full" style={{ width: `${w * 100}%`, background: "rgba(255,255,255,0.06)" }} />
      ))}
      <div className="h-12 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
    </div>
  );
}

// ── Macro pill ────────────────────────────────────────────────────────────────

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <span className="text-[15px] font-bold tabular-nums" style={{ color }}>{Math.round(value)}</span>
      <span className="text-[9px] font-medium" style={{ color }}>{unit}</span>
      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

// ── Ingredient row ────────────────────────────────────────────────────────────

function IngredientRow({ ing }: { ing: SuggestionIngredient }) {
  return (
    <div className="flex items-center justify-between py-1.5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex-1 min-w-0">
        <span className="text-[12.5px] truncate block" style={{ color: "var(--text-primary)" }}>
          {ing.name}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {ing.quantity} {ing.unit}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--calories)" }}>
          {Math.round(ing.calories)} kcal
        </span>
        <div className="flex gap-1">
          <span className="text-[9px] tabular-nums" style={{ color: "var(--protein)" }}>{Math.round(ing.proteinG)}P</span>
          <span className="text-[9px] tabular-nums" style={{ color: "var(--carbs)" }}>{Math.round(ing.carbsG)}G</span>
          <span className="text-[9px] tabular-nums" style={{ color: "var(--fat)" }}>{Math.round(ing.fatG)}L</span>
        </div>
      </div>
    </div>
  );
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion, index, onAdd,
}: {
  suggestion: MealSuggestion;
  index:      number;
  onAdd?:     (s: MealSuggestion) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(index === 1); // middle card open by default
  const [adding,   setAdding]   = useState(false);
  const [added,    setAdded]    = useState(false);

  const handleAdd = async () => {
    if (!onAdd || adding || added) return;
    setAdding(true);
    try {
      await onAdd(suggestion);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl overflow-hidden flex-shrink-0 w-[285px]"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Card header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 text-[22px]"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--border)" }}>
            {suggestion.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              {suggestion.name}
            </h3>
            <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>
              {suggestion.description}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
            <IconClock size={11} style={{ color: "var(--text-muted)" }} />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{suggestion.prepTimeMin} min</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{
              background: suggestion.difficulty === "facile" ? "rgba(34,197,94,0.08)" : "rgba(249,115,22,0.08)",
              border: `1px solid ${suggestion.difficulty === "facile" ? "rgba(34,197,94,0.2)" : "rgba(249,115,22,0.2)"}`,
            }}>
            <IconChefHat size={11} style={{ color: suggestion.difficulty === "facile" ? "#22c55e" : "var(--calories)" }} />
            <span className="text-[10px] capitalize"
              style={{ color: suggestion.difficulty === "facile" ? "#22c55e" : "var(--calories)" }}>
              {suggestion.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg ml-auto"
            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)" }}>
            <IconFlame size={11} style={{ color: "var(--calories)" }} />
            <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
              {Math.round(suggestion.totalNutrition.calories)} kcal
            </span>
          </div>
        </div>

        {/* Macros row */}
        <div className="flex items-center gap-1 p-2.5 rounded-xl mb-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <MacroPill label="Prot." value={suggestion.totalNutrition.proteinG}   unit="g" color="var(--protein)" />
          <div className="w-px h-8 flex-shrink-0" style={{ background: "var(--border)" }} />
          <MacroPill label="Gluc." value={suggestion.totalNutrition.carbsG}     unit="g" color="var(--carbs)" />
          <div className="w-px h-8 flex-shrink-0" style={{ background: "var(--border)" }} />
          <MacroPill label="Lip."  value={suggestion.totalNutrition.fatG}       unit="g" color="var(--fat)" />
          <div className="w-px h-8 flex-shrink-0" style={{ background: "var(--border)" }} />
          <MacroPill label="Fib."  value={suggestion.totalNutrition.fiberG}     unit="g" color="var(--fiber)" />
        </div>

        {/* Toggle ingredients */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between text-[11px] font-medium transition-colors py-1"
          style={{ color: expanded ? "var(--text-secondary)" : "var(--text-muted)" }}
        >
          <span>Ingrédients ({suggestion.ingredients.length})</span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "inline-block" }}
          >
            ▾
          </motion.span>
        </button>
      </div>

      {/* Ingredients list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {suggestion.ingredients.map((ing, i) => (
                <IngredientRow key={i} ing={ing} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tip */}
      {suggestion.tip && (
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.06))",
            border: "1px solid rgba(139,92,246,0.2)",
          }}>
          <p className="text-[11px] leading-relaxed" style={{ color: "#c4b5fd" }}>
            <span className="font-semibold">💡 Conseil ·</span> {suggestion.tip}
          </p>
        </div>
      )}

      {/* Add to log button */}
      {onAdd && (
        <div className="px-4 pb-4">
          <button
            onClick={handleAdd}
            disabled={adding || added}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              background: added
                ? "rgba(52,211,153,0.15)"
                : adding
                  ? "rgba(167,139,250,0.1)"
                  : "rgba(167,139,250,0.18)",
              border: `1px solid ${added ? "rgba(52,211,153,0.4)" : "rgba(167,139,250,0.4)"}`,
              color: added ? "#34d399" : "var(--protein)",
            }}
          >
            {adding
              ? <IconLoader2 size={14} stroke={2} className="animate-spin" />
              : added
                ? <><IconCheck size={14} stroke={2} /> Ajouté au journal !</>
                : <><IconPlus size={14} stroke={2} /> Ajouter ce repas</>
            }
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  open:        boolean;
  meal:        MealType;
  date?:       string;
  goals:       NutritionGoals;
  alreadyKcal: number;
  /** Noms déjà logués aujourd'hui pour ce repas — passés au générateur pour
   *  qu'il évite de reproposer exactement la même chose (vraie alternative,
   *  pas un doublon). */
  excludeFoods?: string[];
  onClose:     () => void;
  onAdded?:    (info: { name: string; calories: number }) => void;
}

export default function MenuSuggestionModal({ open, meal, date, goals, alreadyKcal, excludeFoods = [], onClose, onAdded }: Props) {
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(false);
  const [learned,     setLearned]     = useState(false); // true once likedFoods came back non-empty
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add all ingredients of a suggestion to the log
  const handleAddSuggestion = async (s: MealSuggestion) => {
    if (!date) return;
    const entries = s.ingredients.map((ing: SuggestionIngredient, i: number) => {
      // Estimate grams: if unit is "g" or "ml" use quantity directly, else 100g default
      const isWeightUnit = /^(g|ml|kg|l)$/i.test(ing.unit.trim());
      const servingGrams = isWeightUnit ? ing.quantity : 100;
      return {
        meal,
        foodId:       `ai:${s.id}:${i}`,
        source:       "ai" as const,
        name:         ing.name,
        servingLabel: `${ing.quantity} ${ing.unit}`,
        servingGrams,
        servingQty:   ing.quantity,
        servingUnit:  ing.unit,
        nutrition: {
          calories: ing.calories,
          proteinG: ing.proteinG,
          carbsG:   ing.carbsG,
          fatG:     ing.fatG,
          fiberG:   0,
        },
      };
    });

    const res = await fetch("/api/log/batch", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ date, entries }),
    });
    if (!res.ok) throw new Error("Batch log failed");
    onAdded?.({ name: s.name, calories: Math.round(s.totalNutrition.calories) });
  };

  const load = async () => {
    setLoading(true);
    setError(false);
    setSuggestions([]);
    try {
      // Habit learning (liked foods by category + usual macro split for this
      // meal) and anti-repetition memory now live entirely server-side —
      // see app/lib/meal-habits.ts — the client just relays what's already
      // logged today (excludeFoods) for the "don't repeat today's meal" signal.
      const res = await fetch("/api/menu-suggestions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ meal, goals, alreadyKcal, excludeFoods }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { suggestions: MealSuggestion[]; personalized?: boolean };
      setSuggestions(data.suggestions ?? []);
      setLearned(data.personalized === true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      // scroll to center card after load
      setTimeout(() => {
        if (scrollRef.current) {
          const child = scrollRef.current.children[1] as HTMLElement | undefined;
          child?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      }, 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200]"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="menu-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl overflow-hidden"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderBottom: "none",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4 pt-2 flex-shrink-0">
              <div>
                <h2 className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Idées de repas
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {MEAL_LABELS[meal]} · {Math.round(goals.dailyCalories * (meal === "breakfast" ? 0.25 : meal === "lunch" ? 0.35 : meal === "dinner" ? 0.30 : 0.10))} kcal budget
                  {learned && !loading && " · basé sur tes habitudes"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Refresh */}
                <button
                  onClick={load}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all"
                  style={{
                    background: "rgba(139,92,246,0.1)",
                    border: "1px solid rgba(139,92,246,0.25)",
                    color: "#a78bfa",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading
                    ? <IconLoader2 size={12} className="animate-spin" />
                    : <IconRefresh size={12} />
                  }
                  Actualiser
                </button>
                {/* Close */}
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  <IconX size={15} stroke={2} />
                </button>
              </div>
            </div>

            {/* Cards scroll area */}
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto pb-6 px-4 flex-shrink-0"
              style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
            >
              {loading && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}

              {!loading && error && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                    Impossible de générer les suggestions.
                  </p>
                  <button
                    onClick={load}
                    className="px-4 py-2 rounded-xl text-[12px] font-medium"
                    style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {!loading && !error && suggestions.map((s, i) => (
                <div key={s.id} style={{ scrollSnapAlign: "center" }}>
                  <SuggestionCard
                    suggestion={s}
                    index={i}
                    onAdd={date ? handleAddSuggestion : undefined}
                  />
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="px-5 pb-6 pt-0 flex-shrink-0">
              <p className="text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
                ✨ Suggestions générées par IA · inspirées de l&apos;approche Jean-Michel Cohen
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
