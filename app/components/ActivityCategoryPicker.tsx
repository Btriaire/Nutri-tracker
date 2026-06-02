"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconX } from "@tabler/icons-react";
import { EXERCISE_CATALOG } from "@/app/lib/exercise-catalog";
import type { ExerciseEntry } from "@/app/lib/exercise-catalog";

// ─── Category definitions ──────────────────────────────────────────────────────

type CatId = "endurance" | "musculation" | "loisirs" | "detente";

const ACT_CATEGORIES: Array<{
  id: CatId;
  label: string;
  sub: string;
  c1: string;
  c2: string;
  filter: (e: ExerciseEntry) => boolean;
}> = [
  {
    id: "endurance",
    label: "Endurance",
    sub: "Cardio & course",
    c1: "#38bdf8",
    c2: "#6366f1",
    filter: (e) => e.category === "cardio",
  },
  {
    id: "musculation",
    label: "Musculation",
    sub: "Force & puissance",
    c1: "#fb923c",
    c2: "#f43f5e",
    filter: (e) => e.category === "musculation",
  },
  {
    id: "loisirs",
    label: "Loisirs intense",
    sub: "Sports & jeux",
    c1: "#a78bfa",
    c2: "#ec4899",
    filter: (e) => e.category === "sport" || e.category === "fonctionnel",
  },
  {
    id: "detente",
    label: "Détente",
    sub: "Yoga & mobilité",
    c1: "#34d399",
    c2: "#22d3ee",
    filter: (e) => e.category === "flexibilite",
  },
];

// ─── SVG pictograms ────────────────────────────────────────────────────────────

function SvgEndurance({ color }: { color: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Speed lines */}
      <line x1="4" y1="30" x2="18" y2="30" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.45"/>
      <line x1="7" y1="38" x2="18" y2="38" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
      <line x1="10" y1="22" x2="18" y2="22" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.18"/>
      {/* Head */}
      <circle cx="45" cy="11" r="6" fill={color}/>
      {/* Body — running pose */}
      <path d="M40 20 C36 27 34 32 37 40 L42 50" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M40 20 C44 27 47 33 45 40 L40 50" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      {/* Arms */}
      <path d="M38 26 L30 31" stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M42 22 L52 18" stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

function SvgMuscu({ color }: { color: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left end cap */}
      <rect x="3" y="21" width="11" height="22" rx="4" fill={color}/>
      {/* Left collar */}
      <rect x="14" y="25" width="8" height="14" rx="3" fill={color} opacity="0.75"/>
      {/* Bar */}
      <rect x="22" y="29" width="20" height="6" rx="3" fill={color} opacity="0.45"/>
      {/* Right collar */}
      <rect x="42" y="25" width="8" height="14" rx="3" fill={color} opacity="0.75"/>
      {/* Right end cap */}
      <rect x="50" y="21" width="11" height="22" rx="4" fill={color}/>
    </svg>
  );
}

function SvgLoisirs({ color }: { color: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Racket head (oval) */}
      <ellipse cx="24" cy="23" rx="14" ry="17" stroke={color} strokeWidth="3.5" fill="none"/>
      {/* String lines H */}
      <line x1="11" y1="17" x2="37" y2="17" stroke={color} strokeWidth="1.2" opacity="0.45"/>
      <line x1="11" y1="23" x2="37" y2="23" stroke={color} strokeWidth="1.2" opacity="0.45"/>
      <line x1="11" y1="29" x2="37" y2="29" stroke={color} strokeWidth="1.2" opacity="0.45"/>
      {/* String lines V */}
      <line x1="18" y1="7" x2="18" y2="39" stroke={color} strokeWidth="1.2" opacity="0.45"/>
      <line x1="24" y1="6" x2="24" y2="40" stroke={color} strokeWidth="1.2" opacity="0.45"/>
      <line x1="30" y1="7" x2="30" y2="39" stroke={color} strokeWidth="1.2" opacity="0.45"/>
      {/* Handle */}
      <path d="M34 36 L53 55" stroke={color} strokeWidth="5.5" strokeLinecap="round"/>
      {/* Ball */}
      <circle cx="50" cy="17" r="8" fill={color} opacity="0.22"/>
      <circle cx="50" cy="17" r="8" stroke={color} strokeWidth="2.5" fill="none"/>
      <path d="M44 11 Q47 17 44 23" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M56 11 Q53 17 56 23" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function SvgDetente({ color }: { color: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Center petal */}
      <path d="M32 6 C26 15 26 26 32 34 C38 26 38 15 32 6Z" fill={color}/>
      {/* Left petal */}
      <path d="M14 18 C18 27 25 31 32 34 C28 25 19 18 14 18Z" fill={color} opacity="0.7"/>
      {/* Right petal */}
      <path d="M50 18 C46 27 39 31 32 34 C36 25 45 18 50 18Z" fill={color} opacity="0.7"/>
      {/* Far-left petal */}
      <path d="M8 36 C13 40 22 39 32 34 C24 32 13 32 8 36Z" fill={color} opacity="0.45"/>
      {/* Far-right petal */}
      <path d="M56 36 C51 40 42 39 32 34 C40 32 51 32 56 36Z" fill={color} opacity="0.45"/>
      {/* Leaves */}
      <path d="M20 56 C23 50 27 46 32 56" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M44 56 C41 50 37 46 32 56" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

const CAT_SVGS: Record<CatId, React.ComponentType<{ color: string }>> = {
  endurance:   SvgEndurance,
  musculation: SvgMuscu,
  loisirs:     SvgLoisirs,
  detente:     SvgDetente,
};

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  actFavorites:     string[];
  onToggleFav:      (id: string) => void;
  onSelectExercise: (e: ExerciseEntry) => void;
  userWeightKg:     number;
}

export default function ActivityCategoryPicker({
  actFavorites, onToggleFav, onSelectExercise, userWeightKg,
}: Props) {
  const [catOpen, setCatOpen] = useState<CatId | null>(null);

  const handleSelect = (e: ExerciseEntry) => {
    setCatOpen(null);
    onSelectExercise(e);
  };

  const activeCat = ACT_CATEGORIES.find(c => c.id === catOpen) ?? null;

  return (
    <>
      {/* ── 4 Category boxes ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {ACT_CATEGORIES.map((cat) => {
          const catExercises = EXERCISE_CATALOG.filter(cat.filter);
          const favExercises = actFavorites
            .map(id => catExercises.find(e => e.id === id))
            .filter(Boolean) as ExerciseEntry[];

          const CatSvg = CAT_SVGS[cat.id];

          return (
            <motion.button
              key={cat.id}
              onClick={() => setCatOpen(cat.id)}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="relative overflow-hidden text-left rounded-2xl"
              style={{
                background: `linear-gradient(140deg, ${cat.c1}16 0%, ${cat.c2}0c 100%)`,
                border: `1px solid ${cat.c1}28`,
                minHeight: "110px",
                padding: "14px",
              }}
            >
              {/* Decorative SVG — top-right, large, semi-transparent */}
              <div className="absolute -right-3 -top-3 pointer-events-none"
                style={{ opacity: 0.15 }}>
                <CatSvg color={cat.c1} />
              </div>

              {/* Content */}
              <div className="relative z-10 flex flex-col h-full">
                {/* Icon circle */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 overflow-hidden flex-shrink-0"
                  style={{ background: `${cat.c1}20`, border: `1px solid ${cat.c1}30` }}>
                  <div style={{ width: 36, height: 36, transform: "scale(0.56)", transformOrigin: "center" }}>
                    <CatSvg color={cat.c1} />
                  </div>
                </div>

                <p className="text-[13px] font-semibold leading-tight"
                  style={{ color: cat.c1 }}>
                  {cat.label}
                </p>
                <p className="text-[10px] mt-0.5 mb-auto"
                  style={{ color: "var(--text-muted)" }}>
                  {cat.sub}
                </p>

                {/* Favorite pills */}
                {favExercises.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {favExercises.slice(0, 2).map(e => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={ev => { ev.stopPropagation(); handleSelect(e); }}
                        className="flex items-center gap-0.5 rounded-lg text-[10px] font-medium truncate transition-all active:opacity-70"
                        style={{
                          maxWidth: "72px",
                          padding: "2px 6px",
                          background: `${cat.c1}1a`,
                          border: `1px solid ${cat.c1}30`,
                          color: cat.c1,
                        }}
                      >
                        <span className="flex-shrink-0">{e.emoji}</span>
                        <span className="truncate">{e.name.split(" ")[0]}</span>
                      </button>
                    ))}
                    {favExercises.length > 2 && (
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        +{favExercises.length - 2}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[9px] mt-2.5" style={{ color: `${cat.c1}60` }}>
                    {catExercises.length} activités
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* ── Category sheet portal ── */}
      {catOpen && typeof document !== "undefined" && activeCat && createPortal(
        <AnimatePresence>
          <motion.div
            key="cat-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
            onClick={() => setCatOpen(null)}
          >
            <motion.div
              key="cat-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="w-full max-w-md flex flex-col rounded-t-3xl"
              style={{
                maxHeight: "82vh",
                background: "rgba(10,10,14,0.98)",
                backdropFilter: "blur(24px)",
                borderTop: `1px solid ${activeCat.c1}22`,
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
                <div className="w-9 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${activeCat.c1}18`, border: `1px solid ${activeCat.c1}28` }}>
                    {/* Small icon */}
                    <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
                      {activeCat.id === "endurance" && <>
                        <circle cx="45" cy="11" r="6" fill={activeCat.c1}/>
                        <path d="M40 20 C36 27 34 32 37 40 L42 50" stroke={activeCat.c1} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        <path d="M40 20 C44 27 47 33 45 40 L40 50" stroke={activeCat.c1} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        <path d="M38 26 L30 31" stroke={activeCat.c1} strokeWidth="3.5" strokeLinecap="round"/>
                        <path d="M42 22 L52 18" stroke={activeCat.c1} strokeWidth="3.5" strokeLinecap="round"/>
                      </>}
                      {activeCat.id === "musculation" && <>
                        <rect x="3" y="21" width="11" height="22" rx="4" fill={activeCat.c1}/>
                        <rect x="14" y="25" width="8" height="14" rx="3" fill={activeCat.c1} opacity="0.75"/>
                        <rect x="22" y="29" width="20" height="6" rx="3" fill={activeCat.c1} opacity="0.45"/>
                        <rect x="42" y="25" width="8" height="14" rx="3" fill={activeCat.c1} opacity="0.75"/>
                        <rect x="50" y="21" width="11" height="22" rx="4" fill={activeCat.c1}/>
                      </>}
                      {activeCat.id === "loisirs" && <>
                        <ellipse cx="24" cy="23" rx="14" ry="17" stroke={activeCat.c1} strokeWidth="3.5" fill="none"/>
                        <path d="M34 36 L53 55" stroke={activeCat.c1} strokeWidth="5.5" strokeLinecap="round"/>
                        <circle cx="50" cy="17" r="8" stroke={activeCat.c1} strokeWidth="2.5" fill="none"/>
                      </>}
                      {activeCat.id === "detente" && <>
                        <path d="M32 6 C26 15 26 26 32 34 C38 26 38 15 32 6Z" fill={activeCat.c1}/>
                        <path d="M14 18 C18 27 25 31 32 34 C28 25 19 18 14 18Z" fill={activeCat.c1} opacity="0.7"/>
                        <path d="M50 18 C46 27 39 31 32 34 C36 25 45 18 50 18Z" fill={activeCat.c1} opacity="0.7"/>
                        <path d="M8 36 C13 40 22 39 32 34 C24 32 13 32 8 36Z" fill={activeCat.c1} opacity="0.45"/>
                        <path d="M56 36 C51 40 42 39 32 34 C40 32 51 32 56 36Z" fill={activeCat.c1} opacity="0.45"/>
                      </>}
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-[16px]" style={{ color: activeCat.c1 }}>
                      {activeCat.label}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Tap pour personnaliser · ⭐ pour ajouter aux favoris
                    </p>
                  </div>
                </div>
                <button onClick={() => setCatOpen(null)} className="btn-icon flex-shrink-0">
                  <IconX size={14} />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1">

                {/* ── Favorites section ── */}
                {(() => {
                  const catExercises = EXERCISE_CATALOG.filter(activeCat.filter);
                  const favExercises = actFavorites
                    .map(id => catExercises.find(e => e.id === id))
                    .filter(Boolean) as ExerciseEntry[];
                  if (favExercises.length === 0) return null;
                  return (
                    <div className="px-5 pt-1 pb-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5"
                        style={{ color: "var(--text-muted)" }}>
                        ⭐ Favoris
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {favExercises.map(e => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => handleSelect(e)}
                            className="flex items-center gap-1.5 rounded-xl text-[12px] font-medium transition-all active:opacity-70"
                            style={{
                              padding: "6px 12px",
                              background: `${activeCat.c1}18`,
                              border: `1px solid ${activeCat.c1}35`,
                              color: activeCat.c1,
                            }}
                          >
                            <span>{e.emoji}</span>
                            <span>{e.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Separator ── */}
                <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "0 20px" }} />

                {/* ── Exercise list ── */}
                {EXERCISE_CATALOG.filter(activeCat.filter).map((e, idx, arr) => {
                  const isFav = actFavorites.includes(e.id);
                  const kcal  = Math.round(e.met * userWeightKg * 0.5);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => handleSelect(e)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all"
                      style={{
                        borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      }}
                    >
                      {/* Emoji */}
                      <span className="text-[22px] flex-shrink-0 w-8 text-center">{e.emoji}</span>

                      {/* Name + muscles */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate"
                          style={{ color: "var(--text-primary)" }}>
                          {e.name}
                        </p>
                        {e.muscles && e.muscles.length > 0 && (
                          <p className="text-[10px] truncate mt-0.5"
                            style={{ color: "var(--text-muted)" }}>
                            {e.muscles.slice(0, 3).join(" · ")}
                          </p>
                        )}
                      </div>

                      {/* Kcal estimate */}
                      <span className="text-[11px] tabular-nums flex-shrink-0 font-medium"
                        style={{ color: "rgba(52,211,153,0.75)" }}>
                        ~{kcal}&thinsp;kcal
                      </span>

                      {/* Star toggle */}
                      <button
                        type="button"
                        onClick={ev => { ev.stopPropagation(); onToggleFav(e.id); }}
                        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl transition-all"
                        style={{
                          background: isFav ? `${activeCat.c1}20` : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isFav ? activeCat.c1 + "40" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <span className="text-[15px] leading-none">{isFav ? "⭐" : "☆"}</span>
                      </button>
                    </button>
                  );
                })}

                {/* Bottom padding */}
                <div className="h-6" />
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
