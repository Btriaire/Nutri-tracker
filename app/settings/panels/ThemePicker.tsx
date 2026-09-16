"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronDown, IconChevronUp, IconSun } from "@tabler/icons-react";
import { type Theme } from "@/app/components/ThemeProvider";

const THEME_DEFS: {
  id: Theme;
  name: string;
  desc: string;
  bg: string;
  surface: string;
  accent: string;
  nav: string;
  protein: string;
  carbs: string;
  fat: string;
  radius: string;
}[] = [
  {
    id: "cosmos",
    name: "Cosmos",
    desc: "Sombre & épuré",
    bg: "#09090b",
    surface: "#1c1c21",
    accent: "#a78bfa",
    nav: "#09090b",
    protein: "#a78bfa",
    carbs: "#fbbf24",
    fat: "#60a5fa",
    radius: "10px",
  },
  {
    id: "lumiere",
    name: "Lumière",
    desc: "Clair & aéré",
    bg: "#f7f8fa",
    surface: "#ffffff",
    accent: "#7c3aed",
    nav: "#f7f8fa",
    protein: "#7c3aed",
    carbs: "#d97706",
    fat: "#2563eb",
    radius: "10px",
  },
  {
    id: "mfp",
    name: "MFP Style",
    desc: "MyFitnessPal",
    bg: "#F2F2F2",
    surface: "#FFFFFF",
    accent: "#00A86B",
    nav: "#FFFFFF",
    protein: "#00A86B",
    carbs: "#FF9800",
    fat: "#F44336",
    radius: "5px",
  },
  {
    id: "ocean",
    name: "Océan",
    desc: "Marine & cyan",
    bg: "#0A1628",
    surface: "#0f2040",
    accent: "#00BCD4",
    nav: "#0A1628",
    protein: "#26C6DA",
    carbs: "#FFCA28",
    fat: "#42A5F5",
    radius: "10px",
  },
];

function ThemePreview({ t, selected }: { t: typeof THEME_DEFS[number]; selected: boolean }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden flex flex-col"
      style={{
        background: t.bg,
        border: selected ? `2px solid ${t.accent}` : "2px solid transparent",
        height: 90,
        boxShadow: selected ? `0 0 0 3px ${t.accent}28` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Page content mock */}
      <div className="flex-1 flex flex-col gap-1 p-1.5">
        {/* Card */}
        <div
          style={{
            background: t.surface,
            borderRadius: t.radius,
            padding: "4px 6px",
            border: `1px solid ${t.bg === "#F2F2F2" || t.bg === "#f4f4f8" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
          }}
        >
          {/* Mini chart bars */}
          <div className="flex items-end gap-0.5" style={{ height: 16 }}>
            {[0.5, 0.8, 0.6, 1.0, 0.75, 0.9, 0.65].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * 100}%`,
                  background: i === 3 ? t.accent : `${t.accent}50`,
                  borderRadius: "2px 2px 0 0",
                }}
              />
            ))}
          </div>
        </div>
        {/* Macro dots */}
        <div className="flex gap-1 px-0.5">
          {[t.protein, t.carbs, t.fat].map((c, i) => (
            <div key={i} style={{ width: 18, height: 4, borderRadius: 2, background: c, opacity: 0.9 }} />
          ))}
        </div>
      </div>
      {/* Nav bar mock */}
      <div
        style={{
          background: t.nav,
          borderTop: `1px solid ${t.bg === "#F2F2F2" || t.bg === "#f4f4f8" || t.nav === "#FFFFFF" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"}`,
          height: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          paddingInline: 6,
        }}
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: i === 0 ? t.accent : (t.bg === "#F2F2F2" || t.bg === "#f4f4f8" || t.nav === "#FFFFFF" ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.25)"),
            }}
          />
        ))}
      </div>
      {/* Selected checkmark */}
      {selected && (
        <div
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: t.accent }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

export default function ThemePicker({ current, onChange }: { current: Theme; onChange: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.03 }}
      className="glass overflow-hidden mb-4 mt-4"
    >
      {/* Collapsible header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.12)" }}
          >
            <IconSun size={15} style={{ color: "#a78bfa" }} />
          </div>
          <div className="text-left">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Apparence</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {THEME_DEFS.find(t => t.id === current)?.name ?? "Thème actuel"}
            </p>
          </div>
        </div>
        {open
          ? <IconChevronUp  size={14} style={{ color: "var(--text-muted)" }} />
          : <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="theme-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* 2×2 grid */}
            <div className="grid grid-cols-2 gap-2.5 px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
              {THEME_DEFS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { onChange(t.id); setOpen(false); }}
                  className="text-left pt-3"
                  style={{ outline: "none" }}
                >
                  <ThemePreview t={t} selected={current === t.id} />
                  <div className="mt-1.5 px-0.5">
                    <p
                      className="text-[12px] font-semibold leading-tight"
                      style={{ color: current === t.id ? "var(--text-primary)" : "var(--text-secondary)" }}
                    >
                      {t.name}
                    </p>
                    <p className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
                      {t.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
