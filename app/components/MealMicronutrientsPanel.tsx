"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronDown, IconFlask } from "@tabler/icons-react";
import { format } from "date-fns";
import type { FoodEntry, MealType, MicronutrientDay, MicronutrientCode } from "@/app/lib/types";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";
import { useCustomNutrients } from "@/app/lib/useCustomNutrients";

interface Props {
  entries: FoodEntry[];
  micronutrientData?: MicronutrientDay | null;
}

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Petit-déjeuner",
  lunch:     "Déjeuner",
  dinner:    "Dîner",
  snacks:    "Collations",
};

function entryTime(entry: FoodEntry): string {
  const seconds = Number((entry.loggedAt as unknown as { seconds?: number })?.seconds ?? 0);
  return format(new Date(seconds ? seconds * 1000 : Date.now()), "HH:mm");
}

export default function MealMicronutrientsPanel({ entries, micronutrientData }: Props) {
  useCustomNutrients();
  const [open, setOpen] = useState(false);

  const intakes = micronutrientData?.intakes ?? [];
  if (!entries.length || !intakes.length) return null;

  // Match each food entry to the micronutrient intakes logged for it (source === food name, same time)
  const entryMicronutrients = (entry: FoodEntry) => {
    const time = entryTime(entry);
    return intakes.filter(i => i.source === entry.name && i.time === time);
  };

  const mealsWithData = MEALS
    .map(meal => ({
      meal,
      foods: entries
        .filter(e => e.meal === meal)
        .map(e => ({ entry: e, micronutrients: entryMicronutrients(e) }))
        .filter(f => f.micronutrients.length > 0),
    }))
    .filter(m => m.foods.length > 0);

  if (!mealsWithData.length) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 transition-all"
      >
        <IconFlask size={13} style={{ color: "var(--text-muted)" }} />
        <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
          Micronutriments par aliment
        </span>
        <IconChevronDown
          size={13}
          style={{ color: "var(--text-muted)", marginLeft: "auto", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3 space-y-3">
              {mealsWithData.map(({ meal, foods }) => (
                <div key={meal}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                    {MEAL_LABEL[meal]}
                  </p>
                  <div className="space-y-2">
                    {foods.map(({ entry, micronutrients }) => (
                      <div key={entry.id}>
                        <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                          {entry.name}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {micronutrients.map(m => {
                            const info = MICRONUTRIENT_DB[m.code as MicronutrientCode];
                            if (!info) return null;
                            return (
                              <span
                                key={m.code}
                                className="text-[10px] px-2 py-1 rounded-full font-medium"
                                style={{ background: `${info.color}15`, border: `1px solid ${info.color}33`, color: info.color }}
                              >
                                {info.symbol} {m.amount.toFixed(0)}{m.unit}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
