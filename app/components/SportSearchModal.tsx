"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconSearch, IconX, IconPlus, IconBookmark } from "@tabler/icons-react";
import { EXERCISE_CATALOG, type ExerciseEntry } from "@/app/lib/exercise-catalog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (e: ExerciseEntry) => void;
  onSave: (e: ExerciseEntry) => void;
}

// ─── Category tabs ────────────────────────────────────────────────────────────

type CategoryFilter = "tous" | ExerciseEntry["category"];

const CATEGORY_TABS: { id: CategoryFilter; label: string; emoji: string }[] = [
  { id: "tous",          label: "Tous",       emoji: "🏅" },
  { id: "cardio",        label: "Cardio",     emoji: "🏃" },
  { id: "musculation",   label: "Muscu",      emoji: "🏋️" },
  { id: "sport",         label: "Sport",      emoji: "⚽" },
  { id: "fonctionnel",   label: "Fonct.",     emoji: "🔥" },
  { id: "flexibilite",   label: "Flex",       emoji: "🧘" },
];

const CATEGORY_COLORS: Record<ExerciseEntry["category"], string> = {
  cardio:      "#ef4444",
  musculation: "#8b5cf6",
  sport:       "#3b82f6",
  fonctionnel: "#f97316",
  flexibilite: "#10b981",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SportSearchModal({ open, onClose, onSelect, onSave }: Props) {
  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState<CategoryFilter>("tous");
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setCategory("tous");
      setTimeout(() => searchRef.current?.focus(), 120);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISE_CATALOG.filter((e) => {
      const matchCat = category === "tous" || e.category === category;
      const matchQ   = !q || e.name.toLowerCase().includes(q) || (e.muscles?.some((m) => m.toLowerCase().includes(q)));
      return matchCat && matchQ;
    });
  }, [query, category]);

  const handleSelect = (e: ExerciseEntry) => {
    onSelect(e);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
            className="fixed inset-x-0 bottom-0 z-[70] flex flex-col"
            style={{
              maxHeight: "92dvh",
              borderRadius: "20px 20px 0 0",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderBottom: "none",
            }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
              <div className="w-9 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 pb-3 flex-shrink-0">
              <span className="text-xl">🔍</span>
              <div className="flex-1">
                <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  NutriTrack-Sport
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {EXERCISE_CATALOG.length} exercices disponibles
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <IconX size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Search bar */}
            <div className="px-4 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--border)" }}>
                <IconSearch size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un exercice…"
                  className="flex-1 bg-transparent outline-none text-[14px]"
                  style={{ color: "var(--text-primary)" }}
                />
                {query && (
                  <button onClick={() => setQuery("")} className="flex-shrink-0">
                    <IconX size={13} style={{ color: "var(--text-muted)" }} />
                  </button>
                )}
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto flex-shrink-0 no-scrollbar">
              {CATEGORY_TABS.map((tab) => {
                const active = category === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCategory(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-all"
                    style={{
                      background: active ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${active ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                      color: active ? "var(--protein)" : "var(--text-secondary)",
                    }}
                  >
                    <span>{tab.emoji}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Exercise list */}
            <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ overscrollBehavior: "contain" }}>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <span className="text-4xl">😶</span>
                  <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    Aucun exercice trouvé
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    Essayez un autre terme ou catégorie
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      onSelect={() => handleSelect(exercise)}
                      onSave={() => onSave(exercise)}
                    />
                  ))}
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

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  onSelect,
  onSave,
}: {
  exercise: ExerciseEntry;
  onSelect: () => void;
  onSave: () => void;
}) {
  const color = CATEGORY_COLORS[exercise.category];
  const categoryLabel: Record<ExerciseEntry["category"], string> = {
    cardio:      "Cardio",
    musculation: "Musculation",
    sport:       "Sport",
    fonctionnel: "Fonctionnel",
    flexibilite: "Flexibilité",
  };

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-all"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
    >
      {/* Emoji */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}
      >
        {exercise.emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {exercise.name}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
          >
            {categoryLabel[exercise.category]}
          </span>
        </div>
        <span
          className="text-[11px] font-semibold"
          style={{ color: "var(--calories)" }}
        >
          ~{exercise.kcalPer30min75kg} kcal / 30 min
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Save as template */}
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}
          title="Sauvegarder comme séance type"
        >
          <IconBookmark size={14} style={{ color: "var(--text-muted)" }} />
        </button>
        {/* Select */}
        <button
          onClick={onSelect}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95"
          style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)" }}
          title="Utiliser cet exercice"
        >
          <IconPlus size={14} style={{ color: "var(--protein)" }} />
        </button>
      </div>
    </div>
  );
}
