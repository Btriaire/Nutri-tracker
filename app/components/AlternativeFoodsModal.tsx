"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX, IconSearch, IconLoader2, IconHistory, IconArrowsExchange, IconScale, IconSparkles,
} from "@tabler/icons-react";
import type { FoodNutrition, FoodSearchResult, Lang } from "@/app/lib/types";
import { nutritionPer100gFromServing } from "@/app/lib/nutrition";
import {
  computeSubstitution, rankBySimilarity, profileDistance, quickMatchFromDistance,
  type SubstitutionResult, type MatchLevel,
} from "@/app/lib/food-substitution";
import type { RecentFood } from "@/app/api/food/recent/route";
import type { SuggestedFood } from "@/app/api/food/suggest-alternatives/route";

interface PickedFood {
  name:    string;
  brand?:  string;
  per100g: FoodNutrition;
}

interface Props {
  onClose: () => void;
  lang?:   Lang;
}

const MATCH_STYLE: Record<Exclude<MatchLevel, "na">, { color: string; bg: string; border: string; label: string }> = {
  close:  { color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)",  label: "Proche"  },
  medium: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  label: "Modéré"  },
  far:    { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", label: "Éloigné" },
};

// ─── Food picker (search + recent history) ────────────────────────────────────

function FoodSlot({
  placeholder, onPick, lang,
}: {
  placeholder: string;
  onPick: (f: PickedFood) => void;
  lang: Lang;
}) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent]   = useState<RecentFood[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/food/recent")
      .then((r) => r.json())
      .then((d: { results?: RecentFood[] }) => setRecent(d.results ?? []))
      .catch(() => {})
      .finally(() => setLoadingRecent(false));
  }, []);

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

  const showingSearch = query.trim().length > 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
        <IconSearch size={13} stroke={1.8} style={{ color: "var(--text-muted)" }} />
        <input
          value={query}
          onChange={(e) => doSearch(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[12.5px]"
          style={{ color: "var(--text-primary)" }}
        />
        {searching && <IconLoader2 size={13} className="animate-spin" style={{ color: "var(--text-muted)" }} />}
      </div>

      {!showingSearch && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
          <IconHistory size={11} stroke={2} style={{ color: "var(--text-muted)" }} />
          <span className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--text-muted)" }}>
            Mes aliments récents
          </span>
        </div>
      )}

      <div className="max-h-[170px] overflow-y-auto">
        {showingSearch ? (
          results.length === 0 ? (
            !searching && <p className="text-[11px] text-center py-3" style={{ color: "var(--text-muted)" }}>Aucun résultat</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => onPick({ name: r.name, brand: r.brand, per100g: nutritionPer100gFromServing(r.nutrition, r.servingSizeG) })}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors active:bg-white/5"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span className="text-[12px] truncate" style={{ color: "var(--text-primary)" }}>
                  {r.name}{r.brand ? ` · ${r.brand}` : ""}
                </span>
                <span className="text-[10.5px] flex-shrink-0 tabular-nums" style={{ color: "var(--calories)" }}>
                  {Math.round(r.nutrition.calories)} kcal
                </span>
              </button>
            ))
          )
        ) : loadingRecent ? (
          <div className="flex justify-center py-3">
            <IconLoader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : recent.length === 0 ? (
          <p className="text-[11px] text-center py-3 px-3" style={{ color: "var(--text-muted)" }}>
            Pas encore d&apos;historique — utilisez la recherche.
          </p>
        ) : (
          recent.map((r, i) => (
            <button
              key={`${r.name}-${i}`}
              onClick={() => onPick({ name: r.name, brand: r.brand, per100g: r.nutritionPer100g })}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors active:bg-white/5"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="text-[12px] truncate" style={{ color: "var(--text-primary)" }}>{r.name}</span>
              <span className="text-[10.5px] flex-shrink-0 tabular-nums" style={{ color: "var(--calories)" }}>
                {Math.round(r.nutritionPer100g.calories)} kcal/100g
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PickedCard({
  picked, onClear, gramsInput,
}: {
  picked: PickedFood;
  onClear: () => void;
  gramsInput?: { value: string; onChange: (v: string) => void };
}) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{picked.name}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {Math.round(picked.per100g.calories)} kcal / 100g
          </p>
        </div>
        <button
          onClick={onClear}
          className="text-[10.5px] font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
          style={{ color: "var(--protein)", background: "rgba(59,130,246,0.12)" }}
        >
          Changer
        </button>
      </div>
      {gramsInput && (
        <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <IconScale size={12} stroke={1.8} style={{ color: "var(--text-muted)" }} />
          <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Quantité :</span>
          <input
            type="number"
            inputMode="decimal"
            value={gramsInput.value}
            onChange={(e) => gramsInput.onChange(e.target.value)}
            className="w-16 px-2 py-1 rounded-lg text-[12px] tabular-nums outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>g</span>
        </div>
      )}
    </div>
  );
}

// ─── Spontaneous suggestions ───────────────────────────────────────────────

function SuggestionsPanel({
  source, loading, suggestions, onPick,
}: {
  source:      PickedFood;
  loading:     boolean;
  suggestions: PickedFood[];
  onPick:      (f: PickedFood) => void;
}) {
  if (!loading && suggestions.length === 0) return null;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold flex items-center gap-1" style={{ color: "#a78bfa" }}>
        <IconSparkles size={11} stroke={2} /> Suggestions pour vous
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(167,139,250,0.25)" }}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <IconLoader2 size={13} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>Recherche d&apos;équivalents…</span>
          </div>
        ) : (
          suggestions.map((s, i) => {
            const match = quickMatchFromDistance(profileDistance(source.per100g, s.per100g));
            const style = MATCH_STYLE[match];
            return (
              <button
                key={`${s.name}-${i}`}
                onClick={() => onPick(s)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors active:bg-white/5"
                style={i > 0 ? { borderTop: "1px solid rgba(167,139,250,0.15)" } : undefined}
              >
                <span className="text-[12px] truncate flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                <span className="text-[10px] flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {Math.round(s.per100g.calories)} kcal/100g
                </span>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
                >
                  {style.label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Result: equivalence + macro proximity ────────────────────────────────────

function MacroRow({ row }: { row: SubstitutionResult["rows"][number] }) {
  const style = MATCH_STYLE[row.match === "na" ? "medium" : row.match];
  const maxVal = Math.max(row.sourceValue, row.targetValue, 0.001);
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-medium" style={{ color: "var(--text-secondary)" }}>{row.label}</span>
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
        >
          {row.match === "na" ? "—" : style.label}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] w-4 flex-shrink-0" style={{ color: "var(--text-muted)" }}>A</span>
          <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${(row.sourceValue / maxVal) * 100}%`, background: "var(--protein)" }} />
          </div>
          <span className="text-[10px] tabular-nums w-12 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>
            {row.sourceValue.toFixed(1)}{row.unit}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] w-4 flex-shrink-0" style={{ color: "var(--text-muted)" }}>B</span>
          <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${(row.targetValue / maxVal) * 100}%`, background: "#4ade80" }} />
          </div>
          <span className="text-[10px] tabular-nums w-12 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>
            {row.targetValue.toFixed(1)}{row.unit}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main modal ─────────────────────────────────────────────────────────────

export default function AlternativeFoodsModal({ onClose, lang = "fr" }: Props) {
  const [source, setSource]   = useState<PickedFood | null>(null);
  const [target, setTarget]   = useState<PickedFood | null>(null);
  const [sourceGrams, setSourceGrams] = useState("100");
  const [suggestions, setSuggestions] = useState<PickedFood[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Spontaneous suggestions — as soon as a reference food is picked, blend the user's
  // own recent history with AI-proposed alternatives, ranked by nutritional closeness
  // (biased toward lower carbs/fat). The manual search below stays available regardless.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!source) { setSuggestions([]); return; }
    let cancelled = false;
    setLoadingSuggestions(true);
    setSuggestions([]);
    const sourceKey = source.name.trim().toLowerCase();

    Promise.allSettled([
      fetch("/api/food/recent").then((r) => r.json()) as Promise<{ results?: RecentFood[] }>,
      fetch("/api/food/suggest-alternatives", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: source.name, per100g: source.per100g }),
      }).then((r) => r.json()) as Promise<{ suggestions?: SuggestedFood[] }>,
    ]).then(([recentRes, aiRes]) => {
      if (cancelled) return;
      const fromRecent: PickedFood[] = recentRes.status === "fulfilled"
        ? (recentRes.value.results ?? []).map((r) => ({ name: r.name, brand: r.brand, per100g: r.nutritionPer100g }))
        : [];
      const fromAI: PickedFood[] = aiRes.status === "fulfilled"
        ? (aiRes.value.suggestions ?? []).map((s) => ({ name: s.name, per100g: s.per100g }))
        : [];

      const seen = new Set([sourceKey]);
      const candidates = [...fromAI, ...fromRecent].filter((f) => {
        const key = f.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setSuggestions(rankBySimilarity(source.per100g, candidates, (f) => f.per100g, 4));
      setLoadingSuggestions(false);
    });

    return () => { cancelled = true; };
  }, [source]);

  if (typeof document === "undefined") return null;

  const grams  = Math.max(1, Number(sourceGrams) || 0);
  const result: SubstitutionResult | null = (source && target)
    ? computeSubstitution(source.per100g, target.per100g, grams)
    : null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="alt-foods-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: "92dvh", background: "var(--surface, #1a1a1f)", border: "1px solid var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-[13.5px] font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
              <IconArrowsExchange size={16} stroke={1.8} style={{ color: "var(--protein)" }} />
              Aliments Alternatifs
            </p>
            <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
              <IconX size={17} stroke={1.5} />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 space-y-3">
            <p className="text-[10.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Comparez deux aliments à calories égales pour trouver un substitut adapté —
              choisissez un aliment de référence et une quantité, puis un substitut.
            </p>

            {/* Slot A */}
            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--protein)" }}>
                A · Aliment de référence
              </p>
              {source
                ? <PickedCard picked={source} onClear={() => setSource(null)}
                    gramsInput={{ value: sourceGrams, onChange: setSourceGrams }} />
                : <FoodSlot placeholder="Rechercher un aliment…" lang={lang} onPick={setSource} />
              }
            </div>

            {/* Swap icon */}
            <div className="flex justify-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
                <IconArrowsExchange size={13} stroke={2} style={{ color: "var(--text-muted)", transform: "rotate(90deg)" }} />
              </div>
            </div>

            {/* Spontaneous suggestions — shown until a substitute is chosen */}
            {source && !target && (
              <SuggestionsPanel
                source={source}
                loading={loadingSuggestions}
                suggestions={suggestions}
                onPick={setTarget}
              />
            )}

            {/* Slot B */}
            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "#4ade80" }}>
                {target ? "B · Substitut" : "Ou recherchez un autre aliment"}
              </p>
              {target
                ? <PickedCard picked={target} onClear={() => setTarget(null)} />
                : <FoodSlot placeholder="Rechercher un substitut…" lang={lang} onPick={setTarget} />
              }
            </div>

            {/* Result */}
            {result && source && target && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3 mt-1"
                style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                <div className="flex items-center justify-center gap-2 text-center mb-1">
                  <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--protein)" }}>{grams} g</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{source.name}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>≈</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-center mb-3">
                  <span className="text-[16px] font-bold tabular-nums" style={{ color: "#4ade80" }}>{result.targetGrams} g</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{target.name}</span>
                </div>

                <div className="flex items-center justify-center mb-3">
                  <span
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      color: MATCH_STYLE[result.overallMatch].color,
                      background: MATCH_STYLE[result.overallMatch].bg,
                      border: `1px solid ${MATCH_STYLE[result.overallMatch].border}`,
                    }}
                  >
                    {result.overallMatch === "close" ? "Bonne équivalence nutritionnelle" :
                     result.overallMatch === "medium" ? "Équivalence nutritionnelle moyenne" :
                     "Équivalence nutritionnelle faible"}
                  </span>
                </div>

                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {result.rows.map((row) => <MacroRow key={row.key} row={row} />)}
                </div>

                <p className="text-[9px] italic mt-2 px-0.5" style={{ color: "var(--text-muted)" }}>
                  Calories quasi identiques par construction ({Math.round(result.sourceCalories)} vs {Math.round(result.targetCalories)} kcal) —
                  comparaison indicative des autres macronutriments.
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
