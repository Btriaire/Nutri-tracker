"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconPlus, IconChevronDown, IconCamera, IconTrash, IconChartBar, IconX, IconToolsKitchen2,
  IconEggFried, IconSalad, IconMeat, IconApple } from "@tabler/icons-react";
import FoodItem from "./FoodItem";
import FoodSearchModal, { type AddedInfo } from "./FoodSearchModal";
import MenuSuggestionModal from "./MenuSuggestionModal";
import HungerSlider, { HUNGER_CFG } from "./HungerSlider";
import type { FoodEntry, MealType, Lang, HungerLevel, NutritionGoals } from "@/app/lib/types";

const MEAL_META: Record<MealType, { fr: string; en: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  breakfast: { fr: "Petit-déjeuner", en: "Breakfast", Icon: IconEggFried },
  lunch:     { fr: "Déjeuner",       en: "Lunch",     Icon: IconSalad    },
  dinner:    { fr: "Dîner",          en: "Dinner",    Icon: IconMeat     },
  snacks:    { fr: "Collations",     en: "Snacks",    Icon: IconApple    },
};


interface Props {
  meal:            MealType;
  entries:         FoodEntry[];
  date:            string;
  lang?:           Lang;
  photoUrl?:       string;
  hunger?:         HungerLevel;
  goals?:          NutritionGoals;
  alreadyKcal?:    number;
  onEntriesChange: (meal: MealType, entries: FoodEntry[]) => void;
  onFoodAdded?:    (info: AddedInfo) => void;
  onPhotoChange?:  (meal: MealType, url: string | null) => void;
  onHungerChange?: (meal: MealType, level: HungerLevel | null) => void;
}

export default function MealSection({
  meal, entries, date, lang = "fr",
  photoUrl, hunger, goals, alreadyKcal = 0,
  onEntriesChange, onFoodAdded, onPhotoChange, onHungerChange,
}: Props) {
  const [open,          setOpen]          = useState(true);
  const [modal,         setModal]         = useState(false);
  const [menuModal,     setMenuModal]     = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);

  const meta = MEAL_META[meal];
  const cal  = Math.round(entries.reduce((s, e) => s + e.nutrition.calories, 0));

  const handleDelete = (id: string) => {
    onEntriesChange(meal, entries.filter((e) => e.id !== id));
  };

  const handleUpdate = (id: string, updated: FoodEntry) => {
    onEntriesChange(meal, entries.map((e) => (e.id === id ? updated : e)));
  };

  const handleAdded = async (info: AddedInfo) => {
    const res = await fetch(`/api/log?date=${date}`);
    const { dayLog } = await res.json() as { dayLog: { entries?: FoodEntry[] } | null };
    if (dayLog) onEntriesChange(meal, (dayLog.entries ?? []).filter((e: FoodEntry) => e.meal === meal));
    onFoodAdded?.(info);
  };

  const handlePhotoFile = async (file: File) => {
    setUploading(true);
    try {
      // Compress client-side before upload
      const compressed = await compressImage(file, 800);
      const form = new FormData();
      form.append("image", compressed, "photo.jpg");
      form.append("date", date);
      form.append("meal", meal);
      const res = await fetch("/api/log/photo", { method: "POST", body: form });
      if (res.ok) {
        const { photoUrl: url } = await res.json() as { photoUrl: string };
        onPhotoChange?.(meal, url);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    await fetch(`/api/log/photo?date=${date}&meal=${meal}`, { method: "DELETE" });
    onPhotoChange?.(meal, null);
  };

  return (
    <div className="glass overflow-hidden">
      {/* Hidden camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePhotoFile(f);
          e.target.value = "";
        }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4"
        style={{ borderBottom: open && (entries.length > 0 || photoUrl) ? "1px solid var(--border)" : "none" }}
      >
        {/* Left: toggle expand */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 flex-1 py-3 text-left transition-colors min-w-0"
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
            <meta.Icon size={13} />
          </span>
          <span className="font-medium text-[13.5px] truncate" style={{ color: "var(--text-primary)" }}>
            {meta[lang]}
          </span>
          {cal > 0 ? (
            <span className="text-[12px] font-medium t-calories shrink-0">{cal} kcal</span>
          ) : (
            <span className="label-xs shrink-0">{lang === "fr" ? "Vide" : "Empty"}</span>
          )}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "inline-flex", color: "var(--text-muted)" }}
            className="shrink-0"
          >
            <IconChevronDown size={14} stroke={1.5} />
          </motion.span>
        </button>

        {/* Camera button */}
        <button
          onClick={() => !uploading && cameraRef.current?.click()}
          disabled={uploading}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
          style={{
            background: uploading ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            color: photoUrl ? "var(--protein)" : "var(--text-muted)",
          }}
          aria-label="Photo du repas"
        >
          {uploading
            ? <span className="animate-spin text-[10px]">⏳</span>
            : <IconCamera size={16} stroke={photoUrl ? 2 : 1.5} />
          }
        </button>

        {/* Nutrition panel toggle */}
        {entries.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowNutrition((x) => !x); }}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
            style={{
              background: showNutrition ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${showNutrition ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
              color: showNutrition ? "var(--calories)" : "var(--text-muted)",
            }}
            aria-label="Détail nutritionnel"
          >
            <IconChartBar size={16} stroke={showNutrition ? 2 : 1.5} />
          </button>
        )}

        {/* Hunger slider — compact version in header */}
        <div className="shrink-0" style={{ width: 100 }}>
          <HungerSlider
            value={hunger}
            onChange={(v) => onHungerChange?.(meal, v)}
            compact
          />
        </div>

        {/* Add food button */}
        <button
          onClick={() => setModal(true)}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
          style={{ background: "var(--protein)", color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          aria-label={lang === "fr" ? "Ajouter un aliment" : "Add food"}
        >
          <IconPlus size={17} stroke={2} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            {/* Photo thumbnail */}
            {photoUrl && (
              <PhotoThumb url={photoUrl} onDelete={handleDeletePhoto} />
            )}

            <div className="px-4 pb-3">
              {entries.length > 0 ? (
                <div className="py-1">
                  {entries.map((entry) => (
                    <FoodItem key={entry.id} entry={entry} date={date} onDelete={handleDelete} onUpdate={handleUpdate} />
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setModal(true)}
                  className="w-full py-4 text-[12.5px] transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {lang === "fr" ? "Appuyer sur + pour ajouter un aliment" : "Tap + to add food"}
                </button>
              )}

              {/* Menu suggestion button — toujours visible */}
              {goals && (
                <button
                  onClick={() => setMenuModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-medium mt-1 transition-all"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.08))",
                    border: "1px solid rgba(139,92,246,0.25)",
                    color: "#a78bfa",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(59,130,246,0.14))")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.08))")}
                >
                  <IconToolsKitchen2 size={14} stroke={1.5} />
                  Idées de repas IA
                </button>
              )}
            </div>

            {/* Nutrition breakdown panel */}
            {showNutrition && entries.length > 0 && (
              <div className="px-4 pb-3">
                <div className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                  {/* Header row */}
                  <div className="grid gap-1 px-3 py-2"
                    style={{ gridTemplateColumns: "1fr 52px 40px 40px 40px", borderBottom: "1px solid var(--border)" }}>
                    {["Aliment", "kcal", "P", "G", "L"].map((h) => (
                      <span key={h} className="text-[10px] font-semibold uppercase"
                        style={{ color: "var(--text-muted)" }}>{h}</span>
                    ))}
                  </div>
                  {/* Entry rows */}
                  {entries.map((e) => (
                    <div key={e.id} className="grid gap-1 px-3 py-1.5"
                      style={{ gridTemplateColumns: "1fr 52px 40px 40px 40px", borderBottom: "1px solid var(--border)" }}>
                      <span className="text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>{e.name}</span>
                      <span className="text-[12px] tabular-nums font-medium" style={{ color: "var(--calories)" }}>
                        {Math.round(e.nutrition.calories)}
                      </span>
                      <span className="text-[12px] tabular-nums" style={{ color: "var(--protein)" }}>
                        {Math.round(e.nutrition.proteinG)}g
                      </span>
                      <span className="text-[12px] tabular-nums" style={{ color: "var(--carbs)" }}>
                        {Math.round(e.nutrition.carbsG)}g
                      </span>
                      <span className="text-[12px] tabular-nums" style={{ color: "var(--fat)" }}>
                        {Math.round(e.nutrition.fatG)}g
                      </span>
                    </div>
                  ))}
                  {/* Total row */}
                  {(() => {
                    const totCal  = entries.reduce((s, e) => s + e.nutrition.calories, 0);
                    const totProt = entries.reduce((s, e) => s + e.nutrition.proteinG, 0);
                    const totCarb = entries.reduce((s, e) => s + e.nutrition.carbsG, 0);
                    const totFat  = entries.reduce((s, e) => s + e.nutrition.fatG, 0);
                    return (
                      <div className="grid gap-1 px-3 py-2"
                        style={{ gridTemplateColumns: "1fr 52px 40px 40px 40px", background: "rgba(255,255,255,0.03)" }}>
                        <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>TOTAL</span>
                        <span className="text-[12px] tabular-nums font-bold" style={{ color: "var(--calories)" }}>
                          {Math.round(totCal)}
                        </span>
                        <span className="text-[12px] tabular-nums font-bold" style={{ color: "var(--protein)" }}>
                          {Math.round(totProt)}g
                        </span>
                        <span className="text-[12px] tabular-nums font-bold" style={{ color: "var(--carbs)" }}>
                          {Math.round(totCarb)}g
                        </span>
                        <span className="text-[12px] tabular-nums font-bold" style={{ color: "var(--fat)" }}>
                          {Math.round(totFat)}g
                        </span>
                      </div>
                    );
                  })()}
                  {/* Micro totals */}
                  {(() => {
                    const sodium  = entries.reduce((s, e) => s + (e.nutrition.sodiumMg ?? 0), 0);
                    const calcium = entries.reduce((s, e) => s + (e.nutrition.calciumMg ?? 0), 0);
                    const iron    = entries.reduce((s, e) => s + (e.nutrition.ironMg ?? 0), 0);
                    const vitC    = entries.reduce((s, e) => s + (e.nutrition.vitaminCMg ?? 0), 0);
                    const micros = [
                      { l: "Sodium",  v: sodium,  u: "mg" },
                      { l: "Calcium", v: calcium, u: "mg" },
                      { l: "Fer",     v: iron,    u: "mg" },
                      { l: "Vit. C",  v: vitC,    u: "mg" },
                    ].filter((m) => m.v > 0);
                    if (!micros.length) return null;
                    return (
                      <div className="px-3 py-2 flex flex-wrap gap-3"
                        style={{ borderTop: "1px solid var(--border)" }}>
                        {micros.map(({ l, v, u }) => (
                          <div key={l} className="flex items-center gap-1">
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{l}</span>
                            <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
                              {Math.round(v)}{u}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <FoodSearchModal open={modal} meal={meal} date={date} lang={lang} onClose={() => setModal(false)} onAdded={handleAdded} />

      {goals && (
        <MenuSuggestionModal
          open={menuModal}
          meal={meal}
          date={date}
          goals={goals}
          alreadyKcal={alreadyKcal}
          onClose={() => setMenuModal(false)}
          onAdded={async (info) => { setMenuModal(false); await handleAdded(info); }}
        />
      )}
    </div>
  );
}

// ── Photo thumbnail with lightbox + delete ────────────────────────────────────

function PhotoThumb({ url, onDelete }: { url: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  const lightbox = open && typeof document !== "undefined" && createPortal(
    <AnimatePresence>
      <motion.div
        key="photo-lb"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4"
        style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)" }}
        onClick={() => setOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.88, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          onClick={e => e.stopPropagation()}
          className="flex flex-col items-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Photo du repas"
            className="max-w-[90vw] max-h-[72vh] rounded-2xl object-contain"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }} />
          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}
            >
              <IconTrash size={14} stroke={1.5} /> Supprimer
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl text-[13px] font-medium"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-secondary)" }}
            >
              Fermer
            </button>
          </div>
        </motion.div>
        {/* Close X */}
        <button onClick={() => setOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.12)" }}>
          <IconX size={14} stroke={2} style={{ color: "white" }} />
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <div className="flex items-center gap-2 px-4 pt-2">
      {lightbox}
      {/* Thumbnail — click to enlarge */}
      <button onClick={() => setOpen(true)} className="relative rounded-xl overflow-hidden flex-shrink-0 group"
        style={{ width: 64, height: 64, border: "1px solid var(--border)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Photo du repas" className="w-full h-full object-cover" />
        {/* Expand hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.35)" }}>
          <span className="text-white text-[18px]">🔍</span>
        </div>
      </button>
      {/* Inline delete */}
      <button onClick={onDelete}
        className="flex items-center justify-center w-7 h-7 rounded-lg transition-all"
        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
        title="Supprimer la photo">
        <IconTrash size={13} stroke={2} />
      </button>
    </div>
  );
}

// Compress image to max width, returning a JPEG Blob
async function compressImage(file: File, maxWidth: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
