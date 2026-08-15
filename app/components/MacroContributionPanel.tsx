"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronDown, IconChartBar, IconMeat, IconSalt, IconCandy, IconAvocado } from "@tabler/icons-react";
import type { FoodEntry, FoodNutrition, MealType, TrackedNutrients } from "@/app/lib/types";

interface Props {
  entries: FoodEntry[];
  trackedNutrients?: TrackedNutrients;
}

type MacroKey = "protein" | "sodium" | "sugar" | "saturatedFat";

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Petit-déj.",
  lunch:     "Déjeuner",
  dinner:    "Dîner",
  snacks:    "Collation",
};

interface Category {
  key: MacroKey;
  label: string;
  unit: string;
  color: string;
  Icon: React.ComponentType<{ size?: number; stroke?: number; style?: React.CSSProperties }>;
}

const CATEGORIES: Category[] = [
  { key: "protein",      label: "Protéines",     unit: "g",  color: "var(--protein)", Icon: IconMeat },
  { key: "sodium",       label: "Sel",           unit: "mg", color: "#f59e0b",        Icon: IconSalt },
  { key: "sugar",        label: "Sucres",        unit: "g",  color: "#ec4899",        Icon: IconCandy },
  { key: "saturatedFat", label: "Lipides sat.",  unit: "g",  color: "var(--fat)",     Icon: IconAvocado },
];

function macroValue(n: FoodNutrition, key: MacroKey): number {
  if (key === "protein") return n.proteinG || 0;
  if (key === "sodium") return n.sodiumMg || 0;
  if (key === "sugar") return n.sugarG || 0;
  return n.saturatedFatG || 0;
}

export default function MacroContributionPanel({ entries, trackedNutrients }: Props) {
  const [open, setOpen] = useState(false);

  const visibleCategories = trackedNutrients
    ? CATEGORIES.filter(c => trackedNutrients[c.key])
    : CATEGORIES;

  const [active, setActive] = useState<MacroKey>(visibleCategories[0]?.key ?? "protein");

  const rowsByCategory = useMemo(() => {
    const result = {} as Record<MacroKey, { entry: FoodEntry; amount: number }[]>;
    for (const cat of visibleCategories) {
      result[cat.key] = entries
        .map(e => ({ entry: e, amount: macroValue(e.nutrition, cat.key) }))
        .filter(r => r.amount > 0)
        .sort((a, b) => b.amount - a.amount);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, trackedNutrients]);

  if (!entries.length || !visibleCategories.length) return null;

  const cat = visibleCategories.find(c => c.key === active) ?? visibleCategories[0];
  const rows = rowsByCategory[cat.key] ?? [];
  const dayTotal = rows.reduce((s, r) => s + r.amount, 0);
  const maxAmount = rows.length ? rows[0].amount : 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 transition-all"
      >
        <IconChartBar size={13} style={{ color: "var(--text-muted)" }} />
        <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
          Détail par aliment
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
            <div className="px-3 pb-3">
              <div className="flex gap-1.5 mb-3">
                {visibleCategories.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setActive(c.key)}
                    className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg transition-all"
                    style={{
                      background: active === c.key ? `${c.color}22` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active === c.key ? `${c.color}55` : "var(--border)"}`,
                    }}
                  >
                    <c.Icon size={14} stroke={1.6} style={{ color: active === c.key ? c.color : "var(--text-muted)" }} />
                    <span className="text-[9px] font-semibold" style={{ color: active === c.key ? c.color : "var(--text-muted)" }}>
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>

              {!rows.length ? (
                <p className="text-[11px] py-2 text-center" style={{ color: "var(--text-muted)" }}>
                  Aucun aliment avec {cat.label.toLowerCase()} aujourd&apos;hui
                </p>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Total {cat.label.toLowerCase()} : <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{Math.round(dayTotal)}{cat.unit}</span>
                  </p>

                  {rows.map(({ entry, amount }, i) => {
                    const barPct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                    const dayPct = dayTotal > 0 ? (amount / dayTotal) * 100 : 0;
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.02 }}
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <span className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {entry.name}
                            <span className="text-[9px] ml-1.5" style={{ color: "var(--text-muted)" }}>
                              {MEAL_LABEL[entry.meal]}
                            </span>
                          </span>
                          <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                            {Math.round(amount)}{cat.unit} <span style={{ opacity: 0.7 }}>({Math.round(dayPct)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full relative overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <motion.div
                            className="h-full rounded-full absolute inset-y-0 left-0"
                            style={{ background: cat.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
