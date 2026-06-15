"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconPlus, IconMinus, IconX, IconChevronDown } from "@tabler/icons-react";
import type { AlcoolDrink } from "@/app/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcUnits(ml: number, abv: number) {
  return Math.round((ml * abv) / 1000 * 10) / 10;
}
function calcKcal(ml: number, abv: number) {
  return Math.round(ml * (abv / 100) * 0.789 * 7);
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { type: "Vin rouge",  emoji: "🍷", ml: 150, abv: 13 },
  { type: "Vin blanc",  emoji: "🥂", ml: 150, abv: 12 },
  { type: "Bière 25cl", emoji: "🍺", ml: 250, abv: 5  },
  { type: "Bière 33cl", emoji: "🍺", ml: 330, abv: 5  },
  { type: "Champagne",  emoji: "🍾", ml: 125, abv: 12 },
  { type: "Whisky",     emoji: "🥃", ml: 40,  abv: 40 },
  { type: "Vodka",      emoji: "🥃", ml: 40,  abv: 40 },
  { type: "Cocktail",   emoji: "🍹", ml: 200, abv: 8  },
] as const;

// ─── SVG Wine Glass ───────────────────────────────────────────────────────────

function WineGlassSVG({ units, dailyGoal }: { units: number; dailyGoal: number }) {
  const pct  = dailyGoal > 0 ? Math.min(1, units / dailyGoal) : Math.min(1, units / 3);
  const over = dailyGoal > 0 && units > dailyGoal;
  const liquidColor = over ? "#f87171" : units === 0 ? "rgba(255,255,255,0.10)" : "#c084fc";

  // Bowl geometry: trapezoid top(10,8)→(70,8), narrowing to stem at (37,66)→(43,66)
  const W = 80, bowlT = 8, bowlB = 66, bowlH = bowlB - bowlT;
  const topW = 60, botW = 6;

  const widthAt = (y: number) => topW - (topW - botW) * ((y - bowlT) / bowlH);
  const xL      = (y: number) => (W - widthAt(y)) / 2;
  const xR      = (y: number) => W - xL(y);

  const liquidTop  = bowlB - bowlH * pct;
  const lL = xL(liquidTop), lR = xR(liquidTop);
  const bL = xL(bowlB),     bR = xR(bowlB);

  return (
    <svg width={W} height={96} viewBox={`0 0 ${W} 96`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <clipPath id="ac-bowl">
          <polygon points={`${xL(bowlT)},${bowlT} ${xR(bowlT)},${bowlT} ${bR},${bowlB} ${bL},${bowlB}`} />
        </clipPath>
        <linearGradient id="ac-liq" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={liquidColor} stopOpacity={0.5} />
          <stop offset="50%"  stopColor={liquidColor} stopOpacity={0.9} />
          <stop offset="100%" stopColor={liquidColor} stopOpacity={0.5} />
        </linearGradient>
        <linearGradient id="ac-liq-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={liquidColor} stopOpacity={0.15} />
          <stop offset="100%" stopColor={liquidColor} stopOpacity={0.0} />
        </linearGradient>
        <filter id="ac-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Liquid body */}
      {pct > 0 && (
        <motion.polygon
          points={`${lL},${liquidTop} ${lR},${liquidTop} ${bR},${bowlB} ${bL},${bowlB}`}
          fill="url(#ac-liq)"
          clipPath="url(#ac-bowl)"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `0px ${bowlB}px` }}
          filter={over ? "url(#ac-glow)" : undefined}
        />
      )}

      {/* Shine on liquid surface */}
      {pct > 0.05 && (
        <motion.ellipse
          cx={lL + (lR - lL) * 0.32} cy={liquidTop + 1}
          rx={(lR - lL) * 0.14} ry={1.2}
          fill="rgba(255,255,255,0.55)"
          clipPath="url(#ac-bowl)"
          animate={{ opacity: [0.55, 0.25, 0.55] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Wave on surface */}
      {pct > 0.04 && pct < 0.98 && (
        <motion.path
          d={`M ${lL} ${liquidTop} Q ${W / 2} ${liquidTop - 2.5} ${lR} ${liquidTop}`}
          fill="none" stroke={liquidColor} strokeWidth={1.2} strokeOpacity={0.55}
          clipPath="url(#ac-bowl)"
          animate={{ d: [
            `M ${lL} ${liquidTop} Q ${W / 2} ${liquidTop - 2.5} ${lR} ${liquidTop}`,
            `M ${lL} ${liquidTop} Q ${W / 2} ${liquidTop + 1.5}  ${lR} ${liquidTop}`,
            `M ${lL} ${liquidTop} Q ${W / 2} ${liquidTop - 2.5} ${lR} ${liquidTop}`,
          ]}}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Glass outline — bowl */}
      <polygon
        points={`${xL(bowlT)},${bowlT} ${xR(bowlT)},${bowlT} ${bR},${bowlB} ${bL},${bowlB}`}
        fill="none"
        stroke={units > 0 ? liquidColor : "rgba(255,255,255,0.18)"}
        strokeWidth={1.4}
        strokeOpacity={units > 0 ? 0.7 : 1}
      />

      {/* Glass highlight */}
      <line x1={xL(bowlT) + 4} y1={bowlT + 4} x2={xL(bowlT) + 7} y2={bowlB - 8}
        stroke="rgba(255,255,255,0.10)" strokeWidth={3} strokeLinecap="round" />

      {/* Stem */}
      <line x1={W / 2} y1={bowlB} x2={W / 2} y2={84}
        stroke="rgba(255,255,255,0.22)" strokeWidth={2} strokeLinecap="round" />

      {/* Base */}
      <path d={`M ${W/2 - 14} 86 Q ${W/2} 89 ${W/2 + 14} 86`}
        fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2} strokeLinecap="round" />

      {/* Unit label inside bowl */}
      <text x={W / 2} y={bowlT + bowlH * 0.52}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={units >= 10 ? 11 : 14} fontWeight="700"
        fill={pct > 0.35 ? "#fff" : (units > 0 ? liquidColor : "rgba(255,255,255,0.22)")}>
        {units > 0 ? units.toFixed(1) : "0"}
      </text>
      <text x={W / 2} y={bowlT + bowlH * 0.52 + 13}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={7.5}
        fill={pct > 0.35 ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.22)"}>
        unités
      </text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  date:              string;
  initialDrinks?:    AlcoolDrink[];
  weeklyGoalUnits?:  number;
  onUpdate?:         (drinks: AlcoolDrink[]) => void;
}

export default function AlcoolTracker({ date, initialDrinks = [], weeklyGoalUnits, onUpdate }: Props) {
  const [drinks,     setDrinks]     = useState<AlcoolDrink[]>(initialDrinks);
  const [loading,    setLoading]    = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customType, setCustomType] = useState("");
  const [customMl,   setCustomMl]   = useState(150);
  const [customAbv,  setCustomAbv]  = useState(12);

  const totalUnits = Math.round(drinks.reduce((s, d) => s + d.units, 0) * 10) / 10;
  const totalKcal  = drinks.reduce((s, d) => s + d.kcal, 0);

  // Daily goal = weekly goal / 7 (OMS: ≤ 14u/semaine → ~2u/jour)
  const weeklyGoal = weeklyGoalUnits ?? 14;
  const dailyGoal  = Math.round(weeklyGoal / 7 * 10) / 10;
  const over       = totalUnits > dailyGoal;
  const pct        = Math.min(100, (totalUnits / dailyGoal) * 100);

  const save = async (next: AlcoolDrink[]) => {
    setLoading(true);
    try {
      await fetch("/api/log/alcool", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date, alcoolDrinks: next }),
      });
      onUpdate?.(next);
    } finally { setLoading(false); }
  };

  const addPreset = async (p: typeof PRESETS[number]) => {
    const drink: AlcoolDrink = {
      id: uid(), type: p.type, emoji: p.emoji, ml: p.ml, abv: p.abv,
      units: calcUnits(p.ml, p.abv), kcal: calcKcal(p.ml, p.abv),
    };
    const next = [...drinks, drink];
    setDrinks(next);
    await save(next);
  };

  const addCustom = async () => {
    if (customMl <= 0 || customAbv <= 0) return;
    const drink: AlcoolDrink = {
      id: uid(), type: customType.trim() || "Boisson", emoji: "🥂",
      ml: customMl, abv: customAbv,
      units: calcUnits(customMl, customAbv), kcal: calcKcal(customMl, customAbv),
    };
    const next = [...drinks, drink];
    setDrinks(next);
    setShowCustom(false);
    setCustomType("");
    await save(next);
  };

  const removeDrink = async (id: string) => {
    const next = drinks.filter(d => d.id !== id);
    setDrinks(next);
    await save(next);
  };

  return (
    <div className="glass p-4">

      {/* ── Header: glass SVG + stats ── */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          <WineGlassSVG units={totalUnits} dailyGoal={dailyGoal} />
        </div>

        <div className="flex-1 min-w-0 pt-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <p className="label-xs">Alcool</p>
            {loading && (
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>…</span>
            )}
          </div>

          {/* Stat pills */}
          <div className="flex gap-2 mb-2.5">
            <div className="flex flex-col">
              <span className="text-[20px] font-bold tabular-nums leading-none"
                style={{ color: over ? "#f87171" : "#c084fc" }}>
                {totalUnits.toFixed(1)}
              </span>
              <span className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>unités</span>
            </div>
            {totalKcal > 0 && (
              <div className="flex flex-col">
                <span className="text-[20px] font-bold tabular-nums leading-none"
                  style={{ color: "var(--calories)" }}>
                  {totalKcal}
                </span>
                <span className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>kcal</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden mb-1"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: over ? "#f87171" : "#c084fc" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="text-[9px]" style={{ color: over ? "#f87171" : "var(--text-muted)" }}>
            {over
              ? `+${(totalUnits - dailyGoal).toFixed(1)}u au-delà du seuil journalier`
              : `${totalUnits.toFixed(1)} / ${dailyGoal}u seuil jour (${weeklyGoal}u/sem.)`}
          </p>
        </div>
      </div>

      {/* ── Drinks consumed today ── */}
      {drinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {drinks.map(d => (
            <motion.div key={d.id}
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
              style={{ background: "rgba(192,132,252,0.10)", border: "1px solid rgba(192,132,252,0.25)" }}>
              <span>{d.emoji}</span>
              <span style={{ color: "var(--text-secondary)" }}>{d.type}</span>
              <span className="font-semibold tabular-nums" style={{ color: "#c084fc" }}>
                {d.units.toFixed(1)}u
              </span>
              <button onClick={() => removeDrink(d.id)} disabled={loading}
                className="ml-0.5 opacity-35 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}>
                <IconX size={9} stroke={2.5} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Preset grid ── */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {PRESETS.map(p => {
          const u = calcUnits(p.ml, p.abv);
          return (
            <button key={p.type} onClick={() => addPreset(p)} disabled={loading}
              className="flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl transition-all active:scale-95 hover:border-purple-500/40"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
              <span className="text-[20px] leading-none">{p.emoji}</span>
              <span className="text-[8px] text-center leading-tight w-full px-0.5 truncate"
                style={{ color: "var(--text-muted)" }}>
                {p.type.replace(" 25cl", "").replace(" 33cl", " 33")}
              </span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: "#c084fc" }}>
                {u.toFixed(1)}u
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Custom entry ── */}
      <button onClick={() => setShowCustom(v => !v)}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium transition-all"
        style={{
          background: showCustom ? "rgba(192,132,252,0.10)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${showCustom ? "rgba(192,132,252,0.3)" : "var(--border)"}`,
          color: showCustom ? "#c084fc" : "var(--text-muted)",
        }}>
        <IconPlus size={11} stroke={2.5} />
        Boisson personnalisée
        <motion.span animate={{ rotate: showCustom ? 180 : 0 }} transition={{ duration: 0.2 }}
          style={{ display: "inline-flex" }}>
          <IconChevronDown size={11} stroke={2} />
        </motion.span>
      </button>

      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}>
            <div className="mt-3 space-y-2.5">
              {/* Type input */}
              <input
                type="text"
                placeholder="Type de boisson (optionnel)"
                value={customType}
                onChange={e => setCustomType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-[12px] outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />

              {/* Volume + ABV row */}
              <div className="flex gap-2">
                {/* Volume */}
                <div className="flex-1">
                  <p className="text-[9px] mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Volume (ml)</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCustomMl(v => Math.max(10, v - 25))}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
                      <IconMinus size={10} stroke={2} />
                    </button>
                    <input type="number" value={customMl}
                      onChange={e => setCustomMl(Math.max(5, Number(e.target.value)))}
                      className="flex-1 text-center text-[13px] font-bold rounded-lg outline-none tabular-nums min-w-0"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "5px 2px" }} />
                    <button onClick={() => setCustomMl(v => v + 25)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
                      <IconPlus size={10} stroke={2} />
                    </button>
                  </div>
                </div>

                {/* ABV */}
                <div className="flex-1">
                  <p className="text-[9px] mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Alcool (% vol)</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCustomAbv(v => Math.max(0.5, Math.round((v - 0.5) * 10) / 10))}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
                      <IconMinus size={10} stroke={2} />
                    </button>
                    <input type="number" value={customAbv} step="0.5"
                      onChange={e => setCustomAbv(Math.max(0.1, Number(e.target.value)))}
                      className="flex-1 text-center text-[13px] font-bold rounded-lg outline-none tabular-nums min-w-0"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "5px 2px" }} />
                    <button onClick={() => setCustomAbv(v => Math.round((v + 0.5) * 10) / 10)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
                      <IconPlus size={10} stroke={2} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "rgba(192,132,252,0.06)", border: "1px solid rgba(192,132,252,0.20)" }}>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {customType.trim() || "Boisson"} · {customMl} ml · {customAbv}%
                </span>
                <span className="text-[11px] font-bold" style={{ color: "#c084fc" }}>
                  {calcUnits(customMl, customAbv).toFixed(1)}u · {calcKcal(customMl, customAbv)} kcal
                </span>
              </div>

              {/* Add button */}
              <button onClick={addCustom} disabled={loading}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: "#c084fc", color: "#fff" }}>
                Ajouter cette boisson
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
