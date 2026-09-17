"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconLoader2, IconChevronDown, IconChevronUp, IconUser, IconDeviceFloppy } from "@tabler/icons-react";
import type { NutritionGoals } from "@/app/lib/types";

export default function ProfilePanel({ initialPhotoUrl, initialDisplayName, initialGoals }: {
  initialPhotoUrl?:   string;
  initialDisplayName?: string;
  initialGoals:       NutritionGoals;
}) {
  const [open,        setOpen]        = useState(false);
  const [photoUrl,    setPhotoUrl]    = useState(initialPhotoUrl ?? "");
  const [firstName,   setFirstName]   = useState(initialDisplayName ?? "");
  const [birthYear,   setBirthYear]   = useState(
    initialGoals.age ? (new Date().getFullYear() - initialGoals.age).toString() : ""
  );
  const [profession,  setProfession]  = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const computedAge = birthYear ? new Date().getFullYear() - parseInt(birthYear) : null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        const size = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 128, 128);
        const url = canvas.toDataURL("image/jpeg", 0.85);
        setPhotoUrl(url);
        // Auto-save photo immediately
        await saveProfile({ photoUrl: url });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (extra: Record<string, unknown> = {}) => {
    setSaving(true);
    const age = computedAge && computedAge > 0 && computedAge < 120 ? computedAge : undefined;
    try {
      const payload: Record<string, unknown> = { displayName: firstName, ...extra };
      if (age) payload.goals = { age };
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleSave = () => saveProfile();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.07 }}
      className="glass p-5 mt-4"
    >
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ border: "1.5px solid var(--border-strong)" }}>
          {photoUrl
            ? <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-[18px]"
                style={{ background: "rgba(249,115,22,0.12)" }}>
                <IconUser size={18} style={{ color: "var(--calories)" }} />
              </div>
          }
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>
            {firstName || "Profil"}
          </p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {[computedAge ? `${computedAge} ans` : null, initialGoals.gender === "male" ? "Homme" : initialGoals.gender === "female" ? "Femme" : null, initialGoals.heightCm ? `${initialGoals.heightCm} cm` : null].filter(Boolean).join(" · ") || "Photo · Prénom · Âge"}
          </p>
        </div>
        {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      <AnimatePresence initial={false}>
      {open && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
      <div className="mt-4 flex items-center gap-5">
        {/* Avatar preview */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden"
            style={{ border: "2px solid var(--border-strong)" }}>
            {photoUrl ? (
              <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[32px]"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                👤
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[13px]"
            style={{ background: "var(--calories)", border: "2px solid var(--bg)" }}>
            📷
          </button>
        </div>

        <div className="flex-1 space-y-2.5">
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost w-full text-[12.5px]">
            Choisir une photo
          </button>
          {/* Status row — auto-save feedback */}
          {photoUrl && (
            <div className="flex items-center gap-2 px-1">
              {saving ? (
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <IconLoader2 size={11} className="animate-spin" /> Sauvegarde…
                </span>
              ) : saved ? (
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fiber)" }}>
                  <IconCircleCheck size={12} /> Sauvegardée ✓
                </span>
              ) : (
                <button onClick={handleSave}
                  className="flex items-center gap-1.5 text-[11px] underline underline-offset-2"
                  style={{ color: "var(--text-muted)" }}>
                  <IconDeviceFloppy size={11} /> Sauvegarder manuellement
                </button>
              )}
            </div>
          )}
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Sauvegarde automatique · 128×128 px JPEG
          </p>
        </div>
      </div>

      {/* ── Informations personnelles ── */}
      <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Informations personnelles</p>

        {/* Prénom */}
        <div>
          <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Prénom / Pseudo</label>
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Bruno"
            className="input w-full text-[13px]"
          />
        </div>

        {/* Année de naissance */}
        <div>
          <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Année de naissance
            {computedAge && computedAge > 0 && computedAge < 120 && (
              <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>{computedAge} ans</span>
            )}
          </label>
          <input
            type="number"
            value={birthYear}
            onChange={e => setBirthYear(e.target.value)}
            placeholder={`${new Date().getFullYear() - 35}`}
            min={1920} max={new Date().getFullYear() - 10}
            className="input w-full text-[13px]"
          />
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Utilisé pour calculer le métabolisme de base (BMR)
          </p>
        </div>

        {/* Profession */}
        <div>
          <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Profession <span className="font-normal opacity-60">(optionnel)</span></label>
          <input
            type="text"
            value={profession}
            onChange={e => setProfession(e.target.value)}
            placeholder="ex. Développeur, Enseignant…"
            className="input w-full text-[13px]"
          />
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Aide à contextualiser le niveau d&apos;activité et le stress
          </p>
        </div>

        {/* Notes santé */}
        <div>
          <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Notes de santé <span className="font-normal opacity-60">(optionnel)</span></label>
          <textarea
            value={healthNotes}
            onChange={e => setHealthNotes(e.target.value)}
            placeholder="Allergies, intolérances, conditions médicales à prendre en compte dans les suggestions…"
            rows={3}
            className="input w-full text-[12px] resize-none"
            style={{ lineHeight: "1.5" }}
          />
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Utilisé par les suggestions IA pour personnaliser les recettes et conseils
          </p>
        </div>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving}
          className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
          {saving ? (
            <><IconLoader2 size={14} className="animate-spin" /> Sauvegarde…</>
          ) : saved ? (
            <><IconCircleCheck size={14} /> Profil sauvegardé ✓</>
          ) : (
            <><IconDeviceFloppy size={14} /> Sauvegarder le profil</>
          )}
        </button>
      </div>
      </motion.div>
      )}
      </AnimatePresence>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </motion.div>
  );
}

// ─── Slider Field ─────────────────────────────────────────────────────────────
