"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconSparkles, IconCheck, IconPlus, IconMinus, IconCamera } from "@tabler/icons-react";
import type { FoodSearchResult, MealType } from "@/app/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Per100g {
  calories: number;
  proteinG:  number;
  carbsG:    number;
  fatG:      number;
  fiberG:    number;
}

interface DetectedItem {
  result:   FoodSearchResult;
  per100g:  Per100g;
  grams:    number;
  selected: boolean;
}

interface Props {
  meal:      MealType;
  date:      string;
  mealColor: string;
  onAdded:   () => void;
  onClose:   () => void;
}

const MEAL_FR: Record<string, string> = {
  breakfast: "Petit-déjeuner",
  lunch:     "Déjeuner",
  dinner:    "Dîner",
  snacks:    "Collations",
};

// ─── Image helpers ────────────────────────────────────────────────────────────

async function compressImage(file: File, maxSide = 1200): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale  = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w      = Math.round(img.width  * scale);
      const h      = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.84);
    };
    img.src = url;
  });
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

/** Horizontal stacked P/G/L bar */
function MacroBar({
  proteinG, carbsG, fatG,
  height = 6,
}: {
  proteinG: number; carbsG: number; fatG: number;
  height?: number;
}) {
  const totalCal = proteinG * 4 + carbsG * 4 + fatG * 9;
  if (totalCal <= 0) return (
    <svg viewBox="0 0 200 6" width="100%" height={height} style={{ display: "block" }}>
      <rect x={0} y={0} width={200} height={6} rx={3} fill="rgba(255,255,255,0.06)" />
    </svg>
  );

  const pP = (proteinG * 4 / totalCal) * 200;
  const pC = (carbsG   * 4 / totalCal) * 200;
  const pF = (fatG     * 9 / totalCal) * 200;
  const r  = height / 2;

  return (
    <svg viewBox="0 0 200 6" width="100%" height={height} style={{ display: "block" }}>
      <rect x={0} y={0} width={200} height={6} rx={r} fill="rgba(255,255,255,0.06)" />
      {/* Protein */}
      <rect x={0}          y={0} width={pP} height={6} rx={r}   fill="#3b82f6" />
      {/* Carbs */}
      <rect x={pP}         y={0} width={pC} height={6} rx={0}   fill="#fbbf24" />
      {/* Fat */}
      <rect x={pP + pC}    y={0} width={pF} height={6} rx={0}   fill="#a78bfa" />
      {/* Right cap on last segment */}
      <rect x={200 - r}    y={0} width={r}  height={6} rx={r}   fill="#a78bfa" />
    </svg>
  );
}

/** Spinning arc loader */
function SpinArc({ color, size = 48 }: { color: string; size?: number }) {
  const cx   = size / 2;
  const R    = cx - 4;
  const circ = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3} />
      <motion.circle
        cx={cx} cy={cx} r={R}
        fill="none" stroke={color} strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.28} ${circ}`}
        style={{ transformOrigin: `${cx}px ${cx}px` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="middle" fontSize={16}>✨</text>
    </svg>
  );
}

/** Animated fill bar (single macro) */
function FillBar({
  value, goal, color, width = 100, height = 4,
}: {
  value: number; goal: number; color: string; width?: number; height?: number;
}) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: "block" }}>
      <rect x={0} y={0} width={width} height={height} rx={height / 2} fill="rgba(255,255,255,0.07)" />
      <motion.rect
        x={0} y={0} height={height} rx={height / 2}
        fill={color}
        initial={{ width: 0 }}
        animate={{ width: pct * width }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PhotoMealAnalyzer({ meal, date, mealColor, onAdded, onClose }: Props) {
  type Phase = "idle" | "analyzing" | "results" | "saving";

  const [phase,   setPhase]   = useState<Phase>("idle");
  const [items,   setItems]   = useState<DetectedItem[]>([]);
  const [error,   setError]   = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Scale nutrition from per-100g to current grams ────────────────────────
  const scale = (item: DetectedItem) => {
    const f = item.grams / 100;
    const p = item.per100g;
    return {
      calories: Math.round(p.calories * f),
      proteinG: Math.round(p.proteinG * f * 10) / 10,
      carbsG:   Math.round(p.carbsG   * f * 10) / 10,
      fatG:     Math.round(p.fatG     * f * 10) / 10,
      fiberG:   Math.round(p.fiberG   * f * 10) / 10,
    };
  };

  // ── Photo analysis ────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    const objUrl = URL.createObjectURL(file);
    setPreview(objUrl);
    setPhase("analyzing");
    setError(null);
    try {
      const blob = await compressImage(file, 1200);
      const form = new FormData();
      form.append("image", blob, "photo.jpg");
      const res  = await fetch("/api/food/photo", { method: "POST", body: form });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { results: FoodSearchResult[] };
      const foods = data.results ?? [];
      if (foods.length === 0) {
        setError("Aucun aliment détecté — réessayez avec une photo plus nette");
        setPhase("idle");
        return;
      }
      setItems(foods.map((f) => {
        const base = f.servingSizeG > 0 ? f.servingSizeG : 100;
        return {
          result: f,
          per100g: {
            calories: f.nutrition.calories * 100 / base,
            proteinG: f.nutrition.proteinG  * 100 / base,
            carbsG:   f.nutrition.carbsG    * 100 / base,
            fatG:     f.nutrition.fatG      * 100 / base,
            fiberG:   f.nutrition.fiberG    * 100 / base,
          },
          grams:    f.servingSizeG,
          selected: true,
        };
      }));
      setPhase("results");
    } catch {
      setError("Erreur lors de l'analyse — vérifiez votre connexion");
      setPhase("idle");
    }
  };

  // ── Gram adjustments ──────────────────────────────────────────────────────
  const adjustGrams = (idx: number, delta: number) =>
    setItems((prev) => prev.map((it, i) =>
      i !== idx ? it : { ...it, grams: Math.max(5, it.grams + delta) }
    ));

  const setGrams = (idx: number, g: number) =>
    setItems((prev) => prev.map((it, i) =>
      i !== idx ? it : { ...it, grams: Math.max(5, Math.min(2000, g || 5)) }
    ));

  const toggleSelect = (idx: number) =>
    setItems((prev) => prev.map((it, i) =>
      i !== idx ? it : { ...it, selected: !it.selected }
    ));

  // ── Totals ────────────────────────────────────────────────────────────────
  const selected = items.filter((it) => it.selected);
  const totals   = selected.reduce(
    (acc, it) => {
      const n = scale(it);
      return { calories: acc.calories + n.calories, proteinG: acc.proteinG + n.proteinG, carbsG: acc.carbsG + n.carbsG, fatG: acc.fatG + n.fatG };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  // ── Bulk add ──────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    setPhase("saving");
    try {
      for (const item of selected) {
        const n = scale(item);
        await fetch("/api/log", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            date,
            entry: {
              meal,
              foodId:       item.result.id,
              source:       item.result.source,
              name:         item.result.name,
              servingGrams: item.grams,
              servingQty:   1,
              servingUnit:  "portion",
              servingLabel: `${item.grams}g`,
              nutrition:    n,
            },
          }),
        });
      }
      onAdded();
    } catch {
      setError("Erreur lors de l'ajout");
      setPhase("results");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="pma-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        key="pma-sheet"
        initial={{ opacity: 0, y: 44 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 44 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl flex flex-col"
        style={{
          background:    "rgba(11,11,17,0.98)",
          border:        "1px solid rgba(255,255,255,0.08)",
          borderBottom:  "none",
          backdropFilter: "blur(28px)",
          maxHeight:     "88vh",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${mealColor}22` }}>
            <IconSparkles size={16} style={{ color: mealColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Analyser une photo
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {MEAL_FR[meal] ?? meal} · Nutri-IA Groq Vision
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
            <IconX size={15} />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── IDLE ── */}
          {phase === "idle" && (
            <div>
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-4 px-4 py-3 rounded-xl text-[13px]"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Previous preview */}
              {preview && (
                <div className="mb-4 rounded-xl overflow-hidden" style={{ maxHeight: 160, border: `1px solid ${mealColor}25` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" style={{ width: "100%", objectFit: "cover" }} />
                </div>
              )}

              {/* Capture button */}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-4 py-10 rounded-2xl transition-all active:scale-[0.98]"
                style={{
                  background: `${mealColor}0C`,
                  border:     `2px dashed ${mealColor}45`,
                }}
              >
                {/* SVG camera icon ring */}
                <svg width="68" height="68" viewBox="0 0 68 68" style={{ display: "block" }}>
                  <circle cx="34" cy="34" r="32" fill={`${mealColor}15`} />
                  <circle cx="34" cy="34" r="32" fill="none" stroke={`${mealColor}35`} strokeWidth="1" />
                  <text x="34" y="34" textAnchor="middle" dominantBaseline="middle" fontSize="28">📷</text>
                </svg>
                <div className="text-center px-4">
                  <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    Prendre ou choisir une photo
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                    L'IA identifie chaque aliment et estime les grammages automatiquement
                  </p>
                </div>
              </button>

              {/* Tip */}
              <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-[13px] flex-shrink-0">💡</span>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Pour de meilleurs résultats : photo de dessus, bonne lumière, assiette entière visible
                </p>
              </div>
            </div>
          )}

          {/* ── ANALYZING ── */}
          {phase === "analyzing" && (
            <div className="flex flex-col items-center py-6 gap-5">
              {preview && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ width: 100, height: 100, border: `2px solid ${mealColor}30`, flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </motion.div>
              )}
              <SpinArc color={mealColor} size={52} />
              <div className="text-center">
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Analyse en cours…
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Nutri-IA identifie les aliments
                </p>
              </div>
              {/* Skeleton */}
              <div className="w-full space-y-2">
                {[100, 85, 70].map((w, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0 }} animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ delay: i * 0.12, duration: 1.4, repeat: Infinity }}
                    className="h-[58px] rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", width: `${w}%` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULTS / SAVING ── */}
          {(phase === "results" || phase === "saving") && (
            <div>
              {/* Photo thumbnail */}
              {preview && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-xl overflow-hidden relative"
                  style={{ maxHeight: 120, border: `1px solid ${mealColor}20` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" style={{ width: "100%", objectFit: "cover" }} />
                  <div className="absolute inset-0"
                    style={{ background: "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65))" }} />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                    <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                      ✨ {items.length} aliment{items.length > 1 ? "s" : ""} détecté{items.length > 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => { setPhase("idle"); setItems([]); }}
                      className="text-[10px] px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                      Nouvelle photo
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-3 px-4 py-3 rounded-xl text-[13px]"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Food items */}
              <div className="space-y-2 mb-4">
                {items.map((item, idx) => {
                  const n = scale(item);
                  const isSaving = phase === "saving";
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06, duration: 0.25 }}
                      className="rounded-xl p-3"
                      style={{
                        background: item.selected ? `${mealColor}0D` : "rgba(255,255,255,0.025)",
                        border:     `1px solid ${item.selected ? mealColor + "35" : "rgba(255,255,255,0.07)"}`,
                        opacity:    isSaving ? 0.65 : 1,
                        transition: "background 0.15s, border-color 0.15s, opacity 0.2s",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => !isSaving && toggleSelect(idx)}
                          className="mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                          style={{
                            background: item.selected ? mealColor : "rgba(255,255,255,0.07)",
                            border:     `1.5px solid ${item.selected ? mealColor : "rgba(255,255,255,0.18)"}`,
                          }}>
                          {item.selected && <IconCheck size={11} style={{ color: "#fff" }} />}
                        </button>

                        {/* Name + bars */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium leading-snug truncate"
                            style={{ color: "var(--text-primary)" }}>
                            {item.result.name}
                          </p>
                          <div className="mt-1.5">
                            <MacroBar proteinG={n.proteinG} carbsG={n.carbsG} fatG={n.fatG} height={5} />
                          </div>
                          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                            P&nbsp;{n.proteinG}g&ensp;G&nbsp;{n.carbsG}g&ensp;L&nbsp;{n.fatG}g
                          </p>
                        </div>

                        {/* Calories + gram editor */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-[15px] font-bold tabular-nums leading-none"
                            style={{ color: mealColor }}>
                            {n.calories}
                          </span>
                          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>kcal</span>
                          {/* gram stepper */}
                          <div className="flex items-center gap-1 mt-0.5">
                            <button
                              onClick={() => !isSaving && adjustGrams(idx, -10)}
                              className="w-5 h-5 rounded-md flex items-center justify-center"
                              style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
                              <IconMinus size={9} />
                            </button>
                            <input
                              type="number"
                              value={item.grams}
                              onChange={(e) => !isSaving && setGrams(idx, parseInt(e.target.value))}
                              className="w-11 text-center text-[11px] rounded-md tabular-nums outline-none"
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                border:     "1px solid rgba(255,255,255,0.1)",
                                color:      "var(--text-secondary)",
                                padding:    "2px 3px",
                              }}
                              disabled={isSaving}
                            />
                            <button
                              onClick={() => !isSaving && adjustGrams(idx, 10)}
                              className="w-5 h-5 rounded-md flex items-center justify-center"
                              style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
                              <IconPlus size={9} />
                            </button>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>g</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Total SVG summary */}
              <AnimatePresence>
                {selected.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="rounded-xl overflow-hidden mb-4"
                    style={{ border: "1px solid rgba(255,255,255,0.09)" }}
                  >
                    {/* Calories bar */}
                    <div className="px-3 pt-3 pb-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                          {selected.length} aliment{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
                        </span>
                        <span className="text-[17px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
                          {totals.calories}&nbsp;kcal
                        </span>
                      </div>

                      {/* Macro stacked bar */}
                      <MacroBar proteinG={totals.proteinG} carbsG={totals.carbsG} fatG={totals.fatG} height={8} />

                      {/* Legend */}
                      <div className="flex items-center gap-4 mt-2">
                        {[
                          { label: "Prot.", color: "#3b82f6", val: Math.round(totals.proteinG) },
                          { label: "Gluc.", color: "#fbbf24", val: Math.round(totals.carbsG) },
                          { label: "Lip.",  color: "#a78bfa", val: Math.round(totals.fatG) },
                        ].map(({ label, color, val }) => (
                          <div key={label} className="flex items-center gap-1">
                            <svg width="7" height="7" viewBox="0 0 7 7">
                              <circle cx="3.5" cy="3.5" r="3.5" fill={color} />
                            </svg>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {label} {val}g
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Per-macro fill bars */}
                    <div className="px-3 py-2.5 grid grid-cols-3 gap-3"
                      style={{ background: "rgba(255,255,255,0.02)" }}>
                      {[
                        { label: "Protéines", color: "#3b82f6", val: totals.proteinG, goal: 50 },
                        { label: "Glucides",  color: "#fbbf24", val: totals.carbsG,   goal: 150 },
                        { label: "Lipides",   color: "#a78bfa", val: totals.fatG,     goal: 60 },
                      ].map(({ label, color, val, goal }) => (
                        <div key={label}>
                          <p className="text-[9px] mb-1 truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
                          <FillBar value={val} goal={goal} color={color} width={72} height={4} />
                          <p className="text-[10px] mt-0.5 font-semibold tabular-nums" style={{ color }}>
                            {Math.round(val)}g
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Bottom action bar ── */}
        <AnimatePresence>
          {(phase === "results" || phase === "saving") && selected.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              className="flex-shrink-0 px-5 pt-3 pb-8"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
            >
              <button
                onClick={handleAdd}
                disabled={phase === "saving"}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: phase === "saving" ? `${mealColor}70` : mealColor,
                  color: "#fff",
                  boxShadow: phase !== "saving" ? `0 4px 20px ${mealColor}35` : "none",
                }}>
                {phase === "saving" ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      ⏳
                    </motion.span>
                    Ajout en cours…
                  </>
                ) : (
                  <>
                    <IconCheck size={16} stroke={2.5} />
                    Ajouter {selected.length} aliment{selected.length > 1 ? "s" : ""} · {totals.calories} kcal
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom padding when no action bar */}
        {(phase === "idle" || phase === "analyzing") && (
          <div className="flex-shrink-0" style={{ height: 24 }} />
        )}
      </motion.div>
    </>
  );
}
