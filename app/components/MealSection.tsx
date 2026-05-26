"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, CaretDown } from "@phosphor-icons/react";
import FoodItem from "./FoodItem";
import FoodSearchModal, { type AddedInfo } from "./FoodSearchModal";
import type { FoodEntry, MealType, Lang } from "@/app/lib/types";

const MEAL_META: Record<MealType, { fr: string; en: string; icon: string }> = {
  breakfast: { fr: "Petit-déjeuner", en: "Breakfast", icon: "🌅" },
  lunch:     { fr: "Déjeuner",       en: "Lunch",     icon: "☀️" },
  dinner:    { fr: "Dîner",          en: "Dinner",    icon: "🌙" },
  snacks:    { fr: "Collations",     en: "Snacks",    icon: "🍎" },
};

interface Props {
  meal: MealType;
  entries: FoodEntry[];
  date: string;
  lang?: Lang;
  onEntriesChange: (meal: MealType, entries: FoodEntry[]) => void;
  onFoodAdded?: (info: AddedInfo) => void;
}

export default function MealSection({ meal, entries, date, lang = "fr", onEntriesChange, onFoodAdded }: Props) {
  const [open, setOpen]   = useState(true);
  const [modal, setModal] = useState(false);

  const meta = MEAL_META[meal];
  const cal  = Math.round(entries.reduce((s, e) => s + e.nutrition.calories, 0));

  const handleDelete = (id: string) => {
    onEntriesChange(meal, entries.filter((e) => e.id !== id));
  };

  const handleAdded = async (info: AddedInfo) => {
    const res = await fetch(`/api/log?date=${date}`);
    const { dayLog } = await res.json() as { dayLog: { entries?: FoodEntry[] } | null };
    if (dayLog) onEntriesChange(meal, (dayLog.entries ?? []).filter((e: FoodEntry) => e.meal === meal));
    onFoodAdded?.(info);
  };

  return (
    <div className="glass overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4"
        style={{ borderBottom: open && entries.length > 0 ? "1px solid var(--border)" : "none" }}
      >
        {/* Left: toggle expand */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 flex-1 py-3 text-left transition-colors min-w-0"
        >
          <span className="text-base shrink-0">{meta.icon}</span>
          <span className="font-medium text-[13.5px] truncate" style={{ color: "var(--text-primary)" }}>
            {meta[lang]}
          </span>
          {cal > 0 ? (
            <span className="text-[12px] font-medium t-calories shrink-0">{cal} kcal</span>
          ) : (
            <span className="label-xs shrink-0">{lang === "fr" ? "Vide" : "Empty"}</span>
          )}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "inline-flex", color: "var(--text-muted)" }}
            className="shrink-0"
          >
            <CaretDown size={12} />
          </motion.span>
        </button>

        {/* Right: add button — always visible */}
        <button
          onClick={() => setModal(true)}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
          style={{ background: "var(--protein)", color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          aria-label={lang === "fr" ? "Ajouter un aliment" : "Add food"}
        >
          <Plus size={15} weight="bold" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-3">
              {entries.length > 0 ? (
                <div className="py-1">
                  {entries.map((entry) => (
                    <FoodItem key={entry.id} entry={entry} date={date} onDelete={handleDelete} />
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setModal(true)}
                  className="w-full py-4 text-[12.5px] transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {lang === "fr" ? "Appuyer sur + pour ajouter un aliment" : "Tap + to add food"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FoodSearchModal open={modal} meal={meal} date={date} lang={lang} onClose={() => setModal(false)} onAdded={handleAdded} />
    </div>
  );
}
