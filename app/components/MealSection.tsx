"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, CaretDown } from "@phosphor-icons/react";
import FoodItem from "./FoodItem";
import FoodSearchModal from "./FoodSearchModal";
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
}

export default function MealSection({ meal, entries, date, lang = "fr", onEntriesChange }: Props) {
  const [open, setOpen]   = useState(true);
  const [modal, setModal] = useState(false);

  const meta = MEAL_META[meal];
  const cal  = Math.round(entries.reduce((s, e) => s + e.nutrition.calories, 0));

  const handleDelete = (id: string) => {
    onEntriesChange(meal, entries.filter((e) => e.id !== id));
  };

  const handleAdded = async () => {
    const res = await fetch(`/api/log?date=${date}`);
    const { dayLog } = await res.json() as { dayLog: { entries: FoodEntry[] } | null };
    if (dayLog) onEntriesChange(meal, dayLog.entries.filter((e: FoodEntry) => e.meal === meal));
  };

  return (
    <div className="glass overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 transition-colors"
        style={{ borderBottom: open && entries.length > 0 ? "1px solid var(--border)" : "none" }}
      >
        <span className="text-base">{meta.icon}</span>
        <span className="font-medium text-[13.5px] flex-1 text-left" style={{ color: "var(--text-primary)" }}>
          {meta[lang]}
        </span>
        {cal > 0 && (
          <span className="text-[12px] font-medium t-calories">{cal} kcal</span>
        )}
        {entries.length === 0 && (
          <span className="label-xs">{lang === "fr" ? "Vide" : "Empty"}</span>
        )}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: "inline-flex", color: "var(--text-muted)" }}
        >
          <CaretDown size={12} />
        </motion.span>
      </button>

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
              {entries.length > 0 && (
                <div className="py-1">
                  {entries.map((entry) => (
                    <FoodItem key={entry.id} entry={entry} date={date} onDelete={handleDelete} />
                  ))}
                </div>
              )}

              <button
                onClick={() => setModal(true)}
                className="mt-2 flex items-center gap-2 text-[12.5px] py-1.5 transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--protein)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <Plus size={13} weight="bold" />
                {lang === "fr" ? "Ajouter un aliment" : "Add food"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FoodSearchModal open={modal} meal={meal} date={date} lang={lang} onClose={() => setModal(false)} onAdded={handleAdded} />
    </div>
  );
}
