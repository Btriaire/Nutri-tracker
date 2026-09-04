"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IconArrowLeft, IconSearch, IconLoader2, IconChevronDown, IconScale,
  IconCalendar, IconFlame,
} from "@tabler/icons-react";
import { CATEGORY_META } from "@/app/lib/food-substitution";
import type { BankFood } from "@/app/api/food/bank/route";
import type { MealType } from "@/app/lib/types";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Petit-déj",
  lunch:     "Déjeuner",
  dinner:    "Dîner",
  snacks:    "Collation",
};

const SOURCE_LABEL: Record<string, string> = {
  ciqual: "Ciqual", off: "Open Food Facts", usda: "USDA",
  custom: "Personnel", edamam: "Edamam", nutritionix: "Nutritionix",
  fatsecret: "FatSecret", ai: "Nutri-IA",
};

type SortMode = "frequency" | "recent" | "alpha";

function formatGrams(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`;
}

function formatDate(d: string): string {
  try { return format(parseISO(d), "d MMM yyyy", { locale: fr }); } catch { return d; }
}

// ─── Expanded detail ──────────────────────────────────────────────────────────

function FoodDetail({ food }: { food: BankFood }) {
  const n = food.nutritionPer100g;
  const meals = Object.entries(food.mealCounts) as [MealType, number][];
  const maxMeal = Math.max(1, ...meals.map(([, c]) => c));

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}
    >
      <div className="px-3 pb-3 pt-1 space-y-3">
        {/* Macro row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-semibold" style={{ color: "var(--calories)" }}>
            {Math.round(n.calories)} kcal
          </span>
          <span className="text-[10.5px]" style={{ color: "var(--protein)" }}>{n.proteinG.toFixed(1)}g P</span>
          <span className="text-[10.5px]" style={{ color: "var(--carbs)" }}>{n.carbsG.toFixed(1)}g G</span>
          <span className="text-[10.5px]" style={{ color: "var(--fat)" }}>{n.fatG.toFixed(1)}g L</span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/ 100g</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <IconScale size={11} className="mx-auto mb-0.5" style={{ color: "var(--text-muted)" }} />
            <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>{formatGrams(food.totalGrams)}</p>
            <p className="text-[8.5px]" style={{ color: "var(--text-muted)" }}>au total</p>
          </div>
          <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <IconCalendar size={11} className="mx-auto mb-0.5" style={{ color: "var(--text-muted)" }} />
            <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>{formatDate(food.firstLoggedDate)}</p>
            <p className="text-[8.5px]" style={{ color: "var(--text-muted)" }}>1ère fois</p>
          </div>
          <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <IconFlame size={11} className="mx-auto mb-0.5" style={{ color: "var(--text-muted)" }} />
            <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>{formatDate(food.lastLoggedDate)}</p>
            <p className="text-[8.5px]" style={{ color: "var(--text-muted)" }}>dernière fois</p>
          </div>
        </div>

        {/* Meal breakdown */}
        {meals.length > 0 && (
          <div className="space-y-1">
            {meals.sort((a, b) => b[1] - a[1]).map(([meal, count]) => (
              <div key={meal} className="flex items-center gap-2">
                <span className="text-[9.5px] w-16 flex-shrink-0" style={{ color: "var(--text-muted)" }}>{MEAL_LABELS[meal]}</span>
                <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(count / maxMeal) * 100}%`, background: "var(--protein)" }} />
                </div>
                <span className="text-[9.5px] w-4 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Food row ─────────────────────────────────────────────────────────────────

function FoodRow({ food, expanded, onToggle }: { food: BankFood; expanded: boolean; onToggle: () => void }) {
  const cat = CATEGORY_META[food.category] ?? CATEGORY_META.autre;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button onClick={onToggle} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors active:bg-white/5">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[15px]"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          {cat.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {food.name}{food.brand ? ` · ${food.brand}` : ""}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {SOURCE_LABEL[food.source] ?? food.source} · dernière fois {formatDate(food.lastLoggedDate)}
          </p>
        </div>
        <span className="text-[10.5px] font-semibold px-2 py-1 rounded-full flex-shrink-0 tabular-nums"
          style={{ background: "rgba(167,139,250,0.12)", color: "var(--protein)" }}>
          ×{food.timesLogged}
        </span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
          <IconChevronDown size={13} style={{ color: "var(--text-muted)" }} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && <FoodDetail food={food} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function FoodBankClient() {
  const [foods, setFoods]     = useState<BankFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysScanned, setDaysScanned] = useState(0);
  const [query, setQuery]     = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("frequency");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/food/bank")
      .then((r) => r.json())
      .then((d: { foods?: BankFood[]; daysScanned?: number }) => {
        setFoods(d.foods ?? []);
        setDaysScanned(d.daysScanned ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of foods) m.set(f.category, (m.get(f.category) ?? 0) + 1);
    return m;
  }, [foods]);

  const filtered = useMemo(() => {
    let list = foods;
    if (activeCat) list = list.filter((f) => f.category === activeCat);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.brand?.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortMode === "recent")     sorted.sort((a, b) => b.lastLoggedDate.localeCompare(a.lastLoggedDate));
    else if (sortMode === "alpha") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else                            sorted.sort((a, b) => b.timesLogged - a.timesLogged);
    return sorted;
  }, [foods, activeCat, query, sortMode]);

  // Grouped-by-category view — only used when no search/category-filter narrows things down,
  // since "classé par catégorie" is the point of this screen when browsing broadly.
  const grouped = useMemo(() => {
    if (query.trim() || activeCat) return null;
    const byCat = new Map<string, BankFood[]>();
    for (const f of filtered) {
      const arr = byCat.get(f.category) ?? [];
      arr.push(f);
      byCat.set(f.category, arr);
    }
    return [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, query, activeCat]);

  const SORT_OPTIONS: { id: SortMode; label: string }[] = [
    { id: "frequency", label: "Fréquence" },
    { id: "recent",    label: "Récent" },
    { id: "alpha",     label: "A-Z" },
  ];

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">
        <Link href="/settings" className="flex items-center gap-1.5 text-[12px] mb-4" style={{ color: "var(--text-muted)" }}>
          <IconArrowLeft size={14} /> Retour aux réglages
        </Link>

        <p className="label-xs mb-0.5">Config</p>
        <h1 className="text-[22px] font-semibold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
          Ma banque d&apos;aliments
        </h1>
        <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>
          {loading ? "Chargement…" : `${foods.length} aliments distincts · ${daysScanned} jours d'historique`}
        </p>

        {/* Search */}
        <div className="relative mb-3">
          <IconSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un aliment…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: "none" }}>
          <button onClick={() => setActiveCat(null)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors"
            style={{
              background: !activeCat ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${!activeCat ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
              color: !activeCat ? "var(--protein)" : "var(--text-secondary)",
            }}>
            Tous · {foods.length}
          </button>
          {[...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
            const meta = CATEGORY_META[cat] ?? CATEGORY_META.autre;
            const active = activeCat === cat;
            return (
              <button key={cat} onClick={() => setActiveCat(active ? null : cat)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors"
                style={{
                  background: active ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                  color: active ? "var(--protein)" : "var(--text-secondary)",
                }}>
                {meta.emoji} {meta.label} · {count}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Trier :</span>
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => setSortMode(opt.id)}
              className="px-2 py-0.5 rounded-full text-[10.5px] font-medium transition-colors"
              style={{
                background: sortMode === opt.id ? "rgba(255,255,255,0.08)" : "transparent",
                color: sortMode === opt.id ? "var(--text-primary)" : "var(--text-muted)",
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <IconLoader2 size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : foods.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-3xl">🍽️</span>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              Aucun aliment loggé pour l&apos;instant
            </p>
          </div>
        ) : grouped ? (
          <div className="space-y-5">
            {grouped.map(([cat, items]) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.autre;
              return (
                <div key={cat}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                    {meta.emoji} {meta.label} · {items.length}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((f) => (
                      <FoodRow key={f.name.toLowerCase()} food={f}
                        expanded={expandedKey === f.name.toLowerCase()}
                        onToggle={() => setExpandedKey(expandedKey === f.name.toLowerCase() ? null : f.name.toLowerCase())} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((f) => (
              <FoodRow key={f.name.toLowerCase()} food={f}
                expanded={expandedKey === f.name.toLowerCase()}
                onToggle={() => setExpandedKey(expandedKey === f.name.toLowerCase() ? null : f.name.toLowerCase())} />
            ))}
            {filtered.length === 0 && (
              <p className="text-[12px] text-center py-8" style={{ color: "var(--text-muted)" }}>Aucun résultat</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
