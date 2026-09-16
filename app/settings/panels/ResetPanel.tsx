"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconLoader2, IconChevronDown, IconTrash, IconAlertCircle } from "@tabler/icons-react";

const RESET_OPTIONS = [
  { key: "calories", label: "Journal alimentaire", desc: "Toutes les entrées repas", emoji: "🍽️" },
  { key: "sports",   label: "Activités sportives", desc: "Séances manuelles",        emoji: "🏃" },
  { key: "sleep",    label: "Données de sommeil",  desc: "Historique Google Fit",    emoji: "🌙" },
] as const;

export default function ResetPanel() {
  const [open,     setOpen]     = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm,  setConfirm]  = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done,     setDone]     = useState<Record<string, number> | null>(null);

  const toggle = (key: string) =>
    setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleReset = async () => {
    setResetting(true);
    try {
      const targets = selected.size === 3 ? ["all"] : Array.from(selected);
      const res = await fetch("/api/admin/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const json = await res.json() as { ok: boolean; results: Record<string, number> };
      if (json.ok) { setDone(json.results); setConfirm(false); setSelected(new Set()); }
    } finally { setResetting(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="glass mt-4 overflow-hidden"
    >
      {/* Header (toggle) */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-5 text-left"
        style={{ background: "transparent" }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(248,113,113,0.1)" }}>
          <IconTrash size={17} style={{ color: "#f87171" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Remise à zéro</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Supprimer des données définitivement</p>
        </div>
        <IconChevronDown
          size={16}
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="reset-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5">

      {done && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-[12px]"
          style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "var(--fiber)" }}>
          <IconCircleCheck size={13} />
          Réinitialisation effectuée
        </div>
      )}

      <div className="space-y-2 mb-4">
        {RESET_OPTIONS.map(({ key, label, desc, emoji }) => {
          const checked = selected.has(key);
          return (
            <button key={key} onClick={() => toggle(key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
              style={{
                background: checked ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${checked ? "rgba(248,113,113,0.35)" : "var(--border)"}`,
              }}>
              <span className="text-[18px]">{emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{desc}</p>
              </div>
              <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: checked ? "#f87171" : "rgba(255,255,255,0.06)", border: `1px solid ${checked ? "#f87171" : "var(--border)"}` }}>
                {checked && <IconCircleCheck size={13} color="#fff" />}
              </div>
            </button>
          );
        })}
      </div>

      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          disabled={selected.size === 0}
          className="btn w-full gap-2 text-[13px]"
          style={{
            height: "40px",
            background: selected.size > 0 ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${selected.size > 0 ? "rgba(248,113,113,0.4)" : "var(--border)"}`,
            color: selected.size > 0 ? "#f87171" : "var(--text-muted)",
          }}>
          <IconTrash size={13} />
          Réinitialiser ({selected.size} sélectionné{selected.size > 1 ? "s" : ""})
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px]"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
            <IconAlertCircle size={14} style={{ color: "#f87171" }} />
            <p style={{ color: "#f87171" }}>
              Cette action est <strong>irréversible</strong>. Confirmer la suppression ?
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)} className="btn btn-ghost flex-1 text-[12px]">
              Annuler
            </button>
            <button onClick={handleReset} disabled={resetting}
              className="flex-1 btn gap-1.5 text-[12px]"
              style={{ height: "36px", background: "#f87171", color: "#fff", border: "none" }}>
              {resetting ? <><IconLoader2 size={12} className="animate-spin" /> Suppression…</> : <><IconTrash size={12} /> Confirmer</>}
            </button>
          </div>
        </div>
      )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Fasting Panel ────────────────────────────────────────────────────────────
