"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { IconPlus, IconChevronDown, IconCamera, IconTrash, IconChartBar, IconX, IconToolsKitchen2,
  IconSparkles, IconBookmarkPlus, IconCheck, IconDots } from "@tabler/icons-react";
import { MEAL_META } from "./meal-meta";
import { MealGlucoseStrip } from "./GlucoseSigns";
import type { MealGlucoseResponse } from "@/app/lib/glucose";
import FoodItem from "./FoodItem";
import type { AddedInfo } from "./FoodSearchModal";
import QualityScoreBadge from "./QualityScoreBadge";
import QualityScoreDetail from "./QualityScoreDetail";
import { computeQualityScore } from "@/app/lib/meal-quality";

// Split out of the main bundle: it's a large modal (search, camera, barcode
// scanning) only ever needed after the user taps "add food".
const FoodSearchModal = dynamic(() => import("./FoodSearchModal"), { ssr: false });
import MenuSuggestionModal from "./MenuSuggestionModal";
import HungerSlider, { HUNGER_CFG } from "./HungerSlider";
import PhotoMealAnalyzer from "./PhotoMealAnalyzer";
import type { FoodEntry, MealType, Lang, HungerLevel, NutritionGoals } from "@/app/lib/types";
import type { DietMealReport, DietViolation } from "@/app/lib/diet-program";



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
  dietMealReport?: DietMealReport | null;
  dietViolationsByEntryId?: Record<string, DietViolation[]>;
  onDismissViolation?: (foodName: string) => void;
  /** Reponse glycemique de ce repas (suivi de glycemie active) : affichee sous l'en-tete. */
  glucose?: MealGlucoseResponse | null;
  glucoseTarget?: { min: number; max: number };
  /** Heure retenue du repas (reelle si corrigee, sinon premier aliment) et edition. */
  mealTimeMs?: number | null;
  mealTimeOverridden?: boolean;
  onEditMealTime?: (meal: MealType) => void;
}

export default function MealSection({
  meal, entries, date, lang = "fr",
  photoUrl, hunger, goals, alreadyKcal = 0,
  onEntriesChange, onFoodAdded, onPhotoChange, onHungerChange,
  dietMealReport, dietViolationsByEntryId, onDismissViolation,
  glucose, glucoseTarget, mealTimeMs, mealTimeOverridden, onEditMealTime,
}: Props) {
  const [open,          setOpen]          = useState(true);
  const [modal,         setModal]         = useState(false);
  const [menuModal,     setMenuModal]     = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [photoAnalyzer, setPhotoAnalyzer] = useState(false);
  const [saveMealOpen,  setSaveMealOpen]  = useState(false);
  const [showTools,     setShowTools]     = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);

  const meta = MEAL_META[meal];
  const cal  = Math.round(entries.reduce((s, e) => s + e.nutrition.calories, 0));
  // L'heure de chaque aliment n'apporte rien quand tout a ete saisi au meme moment (cas courant) :
  // on ne l'affiche que si les heures different de plus de 20 min dans ce repas.
  const entryMinutes = entries.map((e) => (e.loggedAt?.seconds ?? 0) / 60).filter((m) => m > 0);
  const showEntryTimes = entryMinutes.length > 1 && Math.max(...entryMinutes) - Math.min(...entryMinutes) > 20;

  const quality = goals && cal > 0
    ? computeQualityScore(
        entries.reduce((acc, e) => ({
          calories:      acc.calories      + e.nutrition.calories,
          proteinG:      acc.proteinG      + e.nutrition.proteinG,
          carbsG:        acc.carbsG        + e.nutrition.carbsG,
          fatG:          acc.fatG          + e.nutrition.fatG,
          fiberG:        acc.fiberG        + e.nutrition.fiberG,
          sugarG:        (acc.sugarG       ?? 0) + (e.nutrition.sugarG ?? 0),
          sodiumMg:      (acc.sodiumMg     ?? 0) + (e.nutrition.sodiumMg ?? 0),
          saturatedFatG: (acc.saturatedFatG ?? 0) + (e.nutrition.saturatedFatG ?? 0),
        }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0, saturatedFatG: 0 }),
        goals,
        cal / Math.max(goals.dailyCalories, 1),
        entries.map(e => e.name),
      )
    : null;

  const handleDelete = (id: string) => {
    onEntriesChange(meal, entries.filter((e) => e.id !== id));
  };

  const handleUpdate = (id: string, updated: FoodEntry) => {
    onEntriesChange(meal, entries.map((e) => (e.id === id ? updated : e)));
  };

  const handleAdded = async (info: AddedInfo) => {
    try {
      const res = await fetch(`/api/log?date=${date}`);
      if (res.ok) {
        const { dayLog } = await res.json() as { dayLog: { entries?: FoodEntry[] } | null };
        if (dayLog) onEntriesChange(meal, (dayLog.entries ?? []).filter((e: FoodEntry) => e.meal === meal));
      }
    } catch (err) {
      console.error("handleAdded refetch failed:", err);
    }
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
    <div className="overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(140deg, color-mix(in srgb, ${meta.color} 7%, transparent) 0%, color-mix(in srgb, ${meta.color2} 3%, transparent) 100%)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 13%, transparent)`,
      }}
    >
      {/* Hidden photo input — no `capture` attribute, so the OS offers both
          "Prendre une photo" and "Choisir dans la bibliothèque" */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
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
        style={{ borderBottom: open && (entries.length > 0 || photoUrl) ? `1px solid color-mix(in srgb, ${meta.color} 9%, transparent)` : "none" }}
      >
        {/* Left: toggle expand */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 flex-1 py-3 text-left transition-colors min-w-0"
        >
          <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: `color-mix(in srgb, ${meta.color} 13%, transparent)`, color: meta.color }}>
            <meta.Icon size={17} />
          </span>
          <span className="min-w-0 flex flex-col">
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-[15px] whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                {meta[lang]}
              </span>
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: "inline-flex", color: "var(--text-muted)" }}
                className="shrink-0"
              >
                <IconChevronDown size={14} stroke={1.5} />
              </motion.span>
            </span>
            {cal > 0 ? (
              <span className="text-[12px] whitespace-nowrap tabular-nums">
                <span className="font-semibold" style={{ color: meta.color }}>{cal} kcal</span>
                {quality && <span style={{ color: quality.color }}> · {quality.label}</span>}
              </span>
            ) : (
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{lang === "fr" ? "Rien de noté" : "Empty"}</span>
            )}
          </span>
          {dietMealReport && dietMealReport.status !== "vide" && (
            <span
              className="text-[12px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{
                color: dietMealReport.status === "ecarts" ? "var(--danger)" : "var(--ok)",
                background: dietMealReport.status === "ecarts" ? "#ef444418" : "#22c55e18",
              }}
              title={dietMealReport.status === "ecarts" ? dietMealReport.violations.map(v => v.reason).join(", ") : "Aucun écart détecté"}
            >
              {dietMealReport.status === "ecarts" ? `⚠️ ${dietMealReport.violations.length}` : "✓"}
            </span>
          )}
        </button>

        {/* Heure du repas : touche = corriger (sert a relier le repas a la glycemie) */}
        {mealTimeMs && onEditMealTime && entries.length > 0 && (
          <button
            onClick={() => onEditMealTime(meal)}
            aria-label={`Heure du repas : ${new Date(mealTimeMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Modifier`}
            className="shrink-0 flex items-center h-7 px-2 rounded-full text-[12px] font-medium tabular-nums transition-colors"
            style={{
              background: mealTimeOverridden ? "color-mix(in srgb, var(--fat) 16%, transparent)" : "var(--layer-1)",
              color: mealTimeOverridden ? "var(--fat)" : "var(--text-secondary)",
            }}
          >
            {new Date(mealTimeMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </button>
        )}

        {/* Outils secondaires (photo, analyse IA, detail, enregistrer) : derriere "..." pour que le nom du repas
            reste lisible sur un telephone, meme quand le repas contient des aliments. */}
        <button
          onClick={() => setShowTools((x) => !x)}
          aria-expanded={showTools}
          aria-label={lang === "fr" ? "Plus d'actions" : "More actions"}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
          style={{
            background: showTools ? "var(--layer-2)" : "transparent",
            color: showTools ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          <IconDots size={18} stroke={1.8} />
        </button>

        {/* Add food button */}
        <button
          onClick={() => setModal(true)}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
          style={{ background: meta.color, color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          aria-label={lang === "fr" ? "Ajouter un aliment" : "Add food"}
        >
          <IconPlus size={17} stroke={2} />
        </button>
      </div>

      {showTools && (
        <div className="flex items-center gap-2 px-4 pb-2.5 pt-1">
        {/* Camera button (meal photo) */}
        <button
          onClick={() => !uploading && cameraRef.current?.click()}
          disabled={uploading}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
          style={{
            background: uploading ? "var(--layer-2)" : "var(--layer-1)",
            border: "1px solid var(--border)",
            color: photoUrl ? "var(--protein)" : "var(--text-muted)",
          }}
          aria-label="Photo du repas"
        >
          {uploading
            ? <span className="animate-spin text-[12px]">⏳</span>
            : <IconCamera size={16} stroke={photoUrl ? 2 : 1.5} />
          }
        </button>

        {/* Nutri-IA photo analyzer button */}
        <button
          onClick={() => setPhotoAnalyzer(true)}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
          style={{
            background: "var(--layer-1)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
          aria-label="Analyser une photo avec l'IA"
          title="Nutri-IA · analyser une photo"
        >
          <IconSparkles size={15} stroke={1.5} />
        </button>

        {/* Nutrition panel toggle */}
        {entries.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowNutrition((x) => !x); }}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
            style={{
              background: showNutrition ? "rgba(249,115,22,0.12)" : "var(--layer-1)",
              border: `1px solid ${showNutrition ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
              color: showNutrition ? "var(--calories)" : "var(--text-muted)",
            }}
            aria-label="Détail nutritionnel"
          >
            <IconChartBar size={16} stroke={showNutrition ? 2 : 1.5} />
          </button>
        )}

        {/* Save as reusable meal */}
        {entries.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setSaveMealOpen(true); }}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all"
            style={{
              background: "var(--layer-1)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
            aria-label="Enregistrer ce repas"
            title="Enregistrer comme repas réutilisable"
          >
            <IconBookmarkPlus size={16} stroke={1.5} />
          </button>
        )}

        </div>
      )}

      {glucose && glucoseTarget && entries.length > 0 && <MealGlucoseStrip response={glucose} target={glucoseTarget} />}

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
              {/* Hunger slider — inside expanded body */}
              {onHungerChange && (
                <div className="pt-2.5 pb-1 flex items-center gap-3">
                  <span className="text-[12px] shrink-0" style={{ color: "var(--text-muted)" }}>Faim avant</span>
                  <HungerSlider
                    value={hunger}
                    onChange={(v) => onHungerChange(meal, v)}
                    compact
                  />
                </div>
              )}

              {entries.length > 0 ? (
                <div className="py-1">
                  {entries.map((entry) => (
                    <FoodItem key={entry.id} entry={entry} date={date} onDelete={handleDelete} onUpdate={handleUpdate} showTime={showEntryTimes}
                      dietViolations={dietViolationsByEntryId?.[entry.id]} onDismissViolation={onDismissViolation} />
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
                  className="flex items-center gap-1.5 min-h-[40px] text-[12px] font-medium mt-1"
                  style={{ color: "var(--protein)" }}
                >
                  <IconToolsKitchen2 size={14} stroke={1.5} />
                  Idées de repas IA
                </button>
              )}
            </div>

            {/* Nutrition breakdown panel */}
            {showNutrition && entries.length > 0 && (
              <div className="px-4 pb-3">
                {quality && (
                  <div className="rounded-xl p-3 mb-2 flex items-center gap-3"
                    style={{ border: `1px solid color-mix(in srgb, ${quality.color} 20%, transparent)`, background: `color-mix(in srgb, ${quality.color} 5%, transparent)` }}>
                    <QualityScoreBadge score={quality.score} size={48} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold mb-1.5" style={{ color: quality.color }}>
                        Qualité nutritionnelle · {quality.label}
                      </p>
                      <QualityScoreDetail quality={quality} />
                    </div>
                  </div>
                )}
                <div className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)", background: "var(--layer-1)" }}>
                  {/* Header row */}
                  <div className="grid gap-1 px-3 py-2"
                    style={{ gridTemplateColumns: "1fr 52px 40px 40px 40px", borderBottom: "1px solid var(--border)" }}>
                    {["Aliment", "kcal", "P", "G", "L"].map((h) => (
                      <span key={h} className="text-[12px] font-semibold uppercase"
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
                        style={{ gridTemplateColumns: "1fr 52px 40px 40px 40px", background: "var(--layer-1)" }}>
                        <span className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>TOTAL</span>
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
                            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{l}</span>
                            <span className="text-[12px] font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
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

      <FoodSearchModal open={modal} meal={meal} date={date} lang={lang} onClose={() => setModal(false)} onAdded={handleAdded}
        onPhotoSaved={(url) => onPhotoChange?.(meal, url)} />

      {/* Nutri-IA photo analyzer */}
      <AnimatePresence>
        {photoAnalyzer && (
          <PhotoMealAnalyzer
            meal={meal}
            date={date}
            mealColor={meta.color}
            onAdded={async () => {
              setPhotoAnalyzer(false);
              await handleAdded({ name: "", calories: 0 });
            }}
            onClose={() => setPhotoAnalyzer(false)}
            onPhotoSaved={(url) => onPhotoChange?.(meal, url)}
          />
        )}
      </AnimatePresence>

      {goals && (
        <MenuSuggestionModal
          open={menuModal}
          meal={meal}
          date={date}
          goals={goals}
          alreadyKcal={alreadyKcal}
          excludeFoods={entries.map((e) => e.name)}
          onClose={() => setMenuModal(false)}
          onAdded={async (info) => { setMenuModal(false); await handleAdded(info); }}
        />
      )}

      {saveMealOpen && (
        <SaveMealModal
          defaultName={meta[lang]}
          entries={entries}
          onClose={() => setSaveMealOpen(false)}
        />
      )}
    </div>
  );
}

// ── Save the current entries as a reusable meal (from a logged or in-progress meal) ──

function SaveMealModal({ defaultName, entries, onClose }: {
  defaultName: string; entries: FoodEntry[]; onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          icon: "🍽️",
          entries: entries.map((e) => ({
            foodId:       e.foodId,
            source:       e.source,
            name:         e.name,
            brand:        e.brand,
            servingLabel: e.servingLabel,
            servingGrams: e.servingGrams,
            nutrition:    e.nutrition,
          })),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(onClose, 900);
      }
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="save-meal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[300] flex items-center justify-center px-5"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-2xl p-5"
          style={{ maxWidth: 340, background: "var(--surface, #1a1a1f)", border: "1px solid var(--border)" }}
        >
          {saved ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full"
                style={{ background: "rgba(52,211,153,0.15)", color: "var(--fiber)" }}>
                <IconCheck size={20} stroke={2} />
              </span>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Repas enregistré</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Enregistrer comme repas
                </p>
                <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
                  <IconX size={16} stroke={1.5} />
                </button>
              </div>
              <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>
                {entries.length} aliment{entries.length > 1 ? "s" : ""} · réutilisable depuis « Repas » lors d&apos;un prochain ajout
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Nom du repas"
                className="w-full px-3 py-2.5 rounded-xl text-[13px] mb-3"
                style={{ background: "var(--layer-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-[12.5px] font-medium"
                  style={{ background: "var(--layer-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || saving}
                  className="flex-1 py-2.5 rounded-xl text-[12.5px] font-medium disabled:opacity-50"
                  style={{ background: "var(--protein)", color: "var(--bg)" }}
                >
                  {saving ? "..." : "Enregistrer"}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
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
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "var(--danger)" }}
            >
              <IconTrash size={14} stroke={1.5} /> Supprimer
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl text-[13px] font-medium"
              style={{ background: "var(--layer-3)", border: "1px solid var(--layer-3)", color: "var(--text-secondary)" }}
            >
              Fermer
            </button>
          </div>
        </motion.div>
        {/* Close X */}
        <button onClick={() => setOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "var(--layer-3)" }}>
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
        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger)" }}
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
