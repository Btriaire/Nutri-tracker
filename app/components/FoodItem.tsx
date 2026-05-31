"use client";

import { useState, useRef, useEffect } from "react";
import { IconTrash, IconChevronDown, IconX, IconLoader2, IconCheck } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FoodEntry } from "@/app/lib/types";
import { scaleNutrition } from "@/app/lib/nutrition";
import FoodPictogram from "./FoodPictogram";

const SOURCE_DOT: Record<string, string> = {
  ciqual: "var(--fiber)",
  off:    "var(--steps)",
  usda:   "var(--carbs)",
  custom: "var(--protein)",
};

interface MicroRow { label: string; value: number | undefined; unit: string; color?: string }

function formatLoggedTime(loggedAt: unknown): string {
  if (!loggedAt || typeof loggedAt !== "object") return "";
  const ts = loggedAt as { _seconds?: number; seconds?: number };
  const sec = ts._seconds ?? ts.seconds;
  if (!sec) return "";
  return new Date(sec * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatMicro(v: number | undefined, unit: string): string {
  if (v == null || v === 0) return "—";
  return `${unit === "mg" ? (v < 1 ? "<1" : Math.round(v)) : v.toFixed(1)} ${unit}`;
}

interface Props {
  entry:     FoodEntry;
  date:      string;
  onDelete:  (id: string) => void;
  onUpdate?: (id: string, updated: FoodEntry) => void;
}

const SNAP = 76; // px revealed when swiped open

export default function FoodItem({ entry, date, onDelete, onUpdate }: Props) {
  const [expanded,   setExpanded]   = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [editGrams,  setEditGrams]  = useState(String(Math.round(entry.servingGrams)));
  const [editSaving, setEditSaving] = useState(false);
  const [swipeX,   setSwipeX]   = useState(0);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef    = useRef<HTMLDivElement>(null);
  const swipeXRef    = useRef(0);
  const lockedRef    = useRef(false);
  const n = entry.nutrition;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    await fetch(`/api/log/${entry.id}?date=${date}`, { method: "DELETE" });
    onDelete(entry.id);
  };

  const toggleEdit = () => {
    if (lockedRef.current) return;
    if (swipeXRef.current > 0) { swipeXRef.current = 0; setSwipeX(0); return; }
    setEditGrams(String(Math.round(entry.servingGrams)));
    setEditing((x) => !x);
    setExpanded(false);
  };

  useEffect(() => { swipeXRef.current = swipeX; }, [swipeX]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startX = 0, startY = 0, baseX = 0;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      startX = e.clientX;
      startY = e.clientY;
      baseX  = swipeXRef.current;
      lockedRef.current = false;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!lockedRef.current) {
        if (Math.hypot(dx, dy) < 6) return;          // dead zone
        if (Math.abs(dy) >= Math.abs(dx)) return;     // vertical → let scroll happen
        lockedRef.current = true;
        setDragging(true);
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }

      const next = Math.min(SNAP, Math.max(0, baseX + dx));
      swipeXRef.current = next;
      // Direct DOM update — no React re-render during drag
      if (sliderRef.current) {
        sliderRef.current.style.transform  = `translateX(${next}px)`;
        sliderRef.current.style.transition = "none";
      }
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary || !lockedRef.current) return;
      lockedRef.current = false;
      setDragging(false);
      const final = swipeXRef.current > SNAP * 0.35 ? SNAP : 0;
      swipeXRef.current = final;
      setSwipeX(final); // sync React state → re-render with snapped position + transition
    };

    el.addEventListener("pointerdown",   onDown);
    el.addEventListener("pointermove",   onMove);
    el.addEventListener("pointerup",     onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown",   onDown);
      el.removeEventListener("pointermove",   onMove);
      el.removeEventListener("pointerup",     onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveEdit = async () => {
    const grams = Math.max(1, parseFloat(editGrams) || 1);
    setEditSaving(true);
    try {
      // Scale per-100g first, then to new grams
      const n100 = scaleNutrition(entry.nutrition, 10000 / entry.servingGrams);
      const nutrition = scaleNutrition(n100, grams);
      const servingLabel = `${Math.round(grams)}g`;
      await fetch(`/api/log/${entry.id}?date=${date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servingGrams: grams, nutrition, servingLabel }),
      });
      onUpdate?.(entry.id, { ...entry, servingGrams: grams, nutrition, servingLabel });
      setEditing(false);
    } finally { setEditSaving(false); }
  };

  const previewGrams = Math.max(1, parseFloat(editGrams) || 1);
  const previewN = editing
    ? scaleNutrition(scaleNutrition(entry.nutrition, 10000 / entry.servingGrams), previewGrams)
    : null;

  const microRows: MicroRow[] = [
    { label: "Sucres",       value: n.sugarG,        unit: "g",  color: "var(--carbs)" },
    { label: "Sat. grasses", value: n.saturatedFatG,  unit: "g",  color: "var(--fat)" },
    { label: "Trans",        value: n.transFatG,       unit: "g" },
    { label: "Cholestérol",  value: n.cholesterolMg,   unit: "mg" },
    { label: "Sodium",       value: n.sodiumMg,        unit: "mg" },
    { label: "Potassium",    value: n.potassiumMg,     unit: "mg" },
    { label: "Calcium",      value: n.calciumMg,       unit: "mg", color: "#94a3b8" },
    { label: "Magnésium",    value: n.magneziumMg,     unit: "mg" },
    { label: "Fer",          value: n.ironMg,          unit: "mg", color: "#f87171" },
    { label: "Zinc",         value: n.zincMg,          unit: "mg" },
    { label: "Vit. C",       value: n.vitaminCMg,      unit: "mg", color: "#fb923c" },
    { label: "Vit. D",       value: n.vitaminDUg,      unit: "µg", color: "#fbbf24" },
    { label: "Vit. B12",     value: n.vitaminB12Ug,    unit: "µg" },
    { label: "Folate (B9)",  value: n.vitaminB9Ug,     unit: "µg" },
    { label: "Alcool",       value: n.alcoholG,        unit: "g" },
  ].filter((r) => r.value != null && r.value > 0);

  const hasMicros = microRows.length > 0;

  if (deleting) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="border-b last:border-b-0"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Swipe-to-delete container */}
      <div ref={containerRef} className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
        {/* Red delete zone revealed on left when swiped */}
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center"
          style={{ width: SNAP, background: "rgba(239,68,68,0.18)" }}
          aria-hidden="true"
        >
          <button
            onClick={handleDelete}
            className="flex flex-col items-center gap-0.5"
            style={{ color: "#f87171" }}
          >
            <IconTrash size={18} stroke={2} />
            <span className="text-[10px] font-semibold">Supprimer</span>
          </button>
        </div>

        {/* Sliding main row */}
        <div
          ref={sliderRef}
          style={{
            transform: `translateX(${swipeX}px)`,
            transition: dragging ? "none" : "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
            background: "var(--bg)",
          }}
        >
          <div className="flex items-center gap-2.5 py-2.5">
            {/* Food pictogram */}
            <FoodPictogram name={entry.name} size={38} />

            {/* Food info — click to toggle edit */}
            <button className="flex-1 min-w-0 text-left" onClick={toggleEdit}>
              <div className="flex items-baseline gap-1.5">
                <p className="text-[13px] font-medium truncate flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>
                  {entry.name}
                </p>
                {formatLoggedTime(entry.loggedAt) && (
                  <span className="text-[10px] tabular-nums flex-shrink-0"
                    style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                    {formatLoggedTime(entry.loggedAt)}
                  </span>
                )}
              </div>
              <p className="text-[11px]" style={{ color: editing ? "var(--protein)" : "var(--text-muted)" }}>
                {editing
                  ? "✏️ Modifier la quantité"
                  : `${entry.servingLabel ?? `${entry.servingQty} ${entry.servingUnit}`}${entry.brand ? ` · ${entry.brand}` : ""}`
                }
              </p>
            </button>

            {/* Calories */}
            <div className="text-right flex-shrink-0">
              <p className="text-[13px] font-semibold t-calories tabular-nums">
                {Math.round(n.calories)} kcal
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                P{Math.round(n.proteinG)} · G{Math.round(n.carbsG)} · L{Math.round(n.fatG)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {hasMicros && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); setEditing(false); }}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.18 }}
                    style={{ display: "inline-flex" }}>
                    <IconChevronDown size={12} stroke={2} />
                  </motion.span>
                </button>
              )}
              <div className="w-1.5 h-1.5 rounded-full mx-1"
                style={{ background: SOURCE_DOT[entry.source] ?? "var(--text-muted)" }} />
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                aria-label="Supprimer"
              >
                <IconTrash size={14} stroke={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline quantity edit panel */}
      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="edit"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="pb-2 pl-8 pr-2">
              {/* Compact input row */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <button
                  onClick={() => setEditGrams((v) => String(Math.max(1, (parseFloat(v) || 1) - 10)))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[15px] transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)" }}>
                  −
                </button>
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={editGrams}
                    onChange={(e) => setEditGrams(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditing(false); }}
                    className="input text-center text-[13px] tabular-nums pr-5"
                    style={{ height: "28px" }}
                    min="1"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]"
                    style={{ color: "var(--text-muted)" }}>g</span>
                </div>
                <button
                  onClick={() => setEditGrams((v) => String((parseFloat(v) || 0) + 10))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[15px] transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)" }}>
                  +
                </button>
                {previewN && (
                  <span className="text-[11px] font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--calories)" }}>
                    {Math.round(previewN.calories)} kcal
                  </span>
                )}
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: "var(--protein)", color: "#fff" }}>
                  {editSaving ? <IconLoader2 size={10} stroke={2} className="animate-spin" /> : <IconCheck size={11} stroke={2} />}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                  <IconX size={11} stroke={2} />
                </button>
              </div>

              {/* Quick-select portion chips */}
              <div className="flex gap-1 flex-wrap pb-1">
                {[25, 50, 75, 100, 150, 200, 250, 300].map((g) => {
                  const active = editGrams === String(g);
                  return (
                    <button
                      key={g}
                      onClick={() => setEditGrams(String(g))}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all"
                      style={{
                        background: active ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                        color: active ? "var(--protein)" : "var(--text-muted)",
                      }}>
                      {g}g
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Micro-nutrient panel */}
      <AnimatePresence initial={false}>
        {expanded && hasMicros && (
          <motion.div
            key="micros"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="pb-3 pl-8">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                {microRows.map(({ label, value, unit, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span className="text-[11px] font-medium tabular-nums"
                      style={{ color: color ?? "var(--text-secondary)" }}>
                      {formatMicro(value, unit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
