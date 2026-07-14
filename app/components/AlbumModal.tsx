"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { IconX, IconLoader2, IconPhoto, IconFlame, IconChevronDown, IconChevronUp,
  IconEggFried, IconSalad, IconMeat, IconApple } from "@tabler/icons-react";
import type { AlbumDay } from "@/app/api/album/route";

type Period = "7d" | "1m" | "3m";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "7d", label: "7 jours",  days: 7  },
  { key: "1m", label: "1 mois",   days: 30 },
  { key: "3m", label: "3 mois",   days: 90 },
];

const MEAL_META: Record<string, { label: string; Icon: React.ComponentType<{ size?: number }> }> = {
  breakfast: { label: "Petit-déjeuner", Icon: IconEggFried },
  lunch:     { label: "Déjeuner",       Icon: IconSalad    },
  dinner:    { label: "Dîner",          Icon: IconMeat     },
  snacks:    { label: "Collations",     Icon: IconApple    },
};

interface Props {
  open:     boolean;
  onClose:  () => void;
}

export default function AlbumModal({ open, onClose }: Props) {
  const [period,   setPeriod]   = useState<Period>("1m");
  const [days,     setDays]     = useState<AlbumDay[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setDays([]);
    try {
      const periodDays = PERIODS.find(x => x.key === p)!.days;
      const today = format(new Date(), "yyyy-MM-dd");
      const from  = format(subDays(new Date(), periodDays), "yyyy-MM-dd");
      const res   = await fetch(`/api/album?from=${from}&to=${today}`);
      if (res.ok) {
        const json = await res.json() as { days: AlbumDay[] };
        setDays(json.days ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) { load(period); }
  }, [open, period, load]);

  const totalPhotos  = days.reduce((s, d) => s + d.photos.length, 0);
  const totalActTh   = days.reduce((s, d) => s + d.activityThumbnails.length, 0);
  const daysWithPhoto = days.filter(d => d.photos.length > 0 || d.activityThumbnails.length > 0).length;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="album-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      >
        {/* Lightbox */}
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-60 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.95)" }}
            onClick={() => setLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Photo" className="max-w-full max-h-full object-contain rounded-xl" />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <IconX size={18} />
            </button>
          </motion.div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
              📸 Album
            </h2>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {totalPhotos + totalActTh} photos · {daysWithPhoto} jours · {days.length} jours loggués
            </p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <IconX size={18} />
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-2 px-4 py-3 flex-shrink-0">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: period === p.key ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${period === p.key ? "rgba(249,115,22,0.5)" : "var(--border)"}`,
                color: period === p.key ? "var(--calories)" : "var(--text-secondary)",
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <IconLoader2 size={28} className="animate-spin" style={{ color: "var(--calories)" }} />
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Chargement de l&apos;album…</p>
            </div>
          ) : days.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <IconPhoto size={40} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune donnée sur cette période</p>
            </div>
          ) : (
            <div className="space-y-3">
              {days.map(day => {
                const hasContent = day.photos.length > 0 || day.activityThumbnails.length > 0;
                const hasMeals = Object.values(day.meals).some(m => m.length > 0);
                const isExpanded = expanded === day.date;
                const dateLabel  = format(parseISO(day.date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: fr });

                return (
                  <motion.div key={day.date}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                  >
                    {/* Day header */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : day.date)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                      style={{ background: "transparent" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold capitalize truncate" style={{ color: "var(--text-primary)" }}>
                          {dateLabel}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {day.totalCalories > 0 && (
                            <span className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--calories)" }}>
                              <IconFlame size={10} /> {day.totalCalories} kcal
                            </span>
                          )}
                          {day.activityNames.length > 0 && (
                            <span className="text-[10px]" style={{ color: "var(--fit-green)" }}>
                              🏃 {day.activityNames.slice(0, 2).join(", ")}
                            </span>
                          )}
                          {(day.photos.length + day.activityThumbnails.length) > 0 && (
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              📷 {day.photos.length + day.activityThumbnails.length}
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded
                        ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      }
                    </button>

                    {/* Photos strip (always visible if photos exist) */}
                    {hasContent && (
                      <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                        {[...day.photos.map(p => ({ src: p.dataUrl, key: p.id, label: p.label ?? "Photo du jour" })),
                          ...day.activityThumbnails.map(t => ({ src: t.thumb, key: t.id, label: t.name }))
                        ].map(ph => (
                          <button key={ph.key}
                            onClick={() => setLightbox(ph.src)}
                            className="flex-shrink-0 rounded-xl overflow-hidden transition-transform active:scale-95"
                            style={{ width: 80, height: 80 }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ph.src} alt={ph.label}
                              className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Meal list (expanded) */}
                    <AnimatePresence>
                      {isExpanded && hasMeals && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                          style={{ borderTop: "1px solid var(--border)" }}
                        >
                          <div className="px-4 py-3 space-y-3">
                            {(["breakfast", "lunch", "dinner", "snacks"] as const).map(meal => {
                              const entries = day.meals[meal];
                              if (entries.length === 0) return null;
                              const total = entries.reduce((s, e) => s + e.calories, 0);
                              return (
                                <div key={meal}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      {(() => {
                                        const m = MEAL_META[meal];
                                        if (!m) return null;
                                        return (
                                          <>
                                            <span className="flex items-center justify-center w-4 h-4 rounded-sm flex-shrink-0"
                                              style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}>
                                              <m.Icon size={10} />
                                            </span>
                                            <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                                              {m.label}
                                            </p>
                                          </>
                                        );
                                      })()}
                                    </div>
                                    <span className="text-[10px]" style={{ color: "var(--calories)" }}>
                                      {total} kcal
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    {entries.map((e, i) => (
                                      <div key={i} className="flex items-center justify-between">
                                        <span className="text-[12px] truncate flex-1 pr-2" style={{ color: "var(--text-primary)" }}>
                                          {e.name}
                                        </span>
                                        <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                                          {e.grams}g · {e.calories} kcal
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
