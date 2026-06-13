"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconBriefcase, IconSofa, IconPlaneInflight, IconLoader2, IconSparkles } from "@tabler/icons-react";
import type { DayType } from "@/app/lib/types";

const DAY_TYPES: {
  key: DayType;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  color: string;
  bg: string;
}[] = [
  { key: "work",   label: "Travail",      Icon: IconBriefcase,    color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  { key: "rest",   label: "Repos",        Icon: IconSofa,         color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
  { key: "travel", label: "Déplacement",  Icon: IconPlaneInflight, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
];

/** Derive work/rest from the date string "YYYY-MM-DD" (local time, avoids UTC shift) */
function inferDayType(date: string): "work" | "rest" {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6 ? "rest" : "work";
}

interface Props {
  date:          string;
  initialType?:  DayType;
  initialJetlag?: boolean;
}

export default function DayTypeSelector({ date, initialType, initialJetlag }: Props) {
  const auto     = !initialType;            // true = never manually set
  const autoType = inferDayType(date);

  const [dayType, setDayType] = useState<DayType>(initialType ?? autoType);
  const [isAuto,  setIsAuto]  = useState(auto);  // drives the "auto" badge
  const [jetlag,  setJetlag]  = useState(initialJetlag ?? false);
  const [saving,  setSaving]  = useState(false);
  const savedRef = useRef(false);           // prevent double auto-save in StrictMode

  /* Auto-save derived type once on mount when nothing was stored */
  useEffect(() => {
    if (!auto || savedRef.current) return;
    savedRef.current = true;
    void saveToApi(autoType, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveToApi(type: DayType | null, jl: boolean) {
    setSaving(true);
    try {
      await fetch("/api/log", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, dayType: type, jetlag: type === "travel" ? jl : false }),
      });
    } finally { setSaving(false); }
  }

  function toggleType(key: DayType) {
    const next = dayType === key ? null : key;
    setDayType(next ?? inferDayType(date));
    setIsAuto(false);                       // explicit click clears the auto badge
    void saveToApi(next, next === "travel" ? jetlag : false);
  }

  function toggleJetlag() {
    const next = !jetlag;
    setJetlag(next);
    setIsAuto(false);
    void saveToApi(dayType, next);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {DAY_TYPES.map(({ key, label, Icon, color, bg }) => {
        const active        = dayType === key;
        const showAutoBadge = active && isAuto;
        return (
          <button
            key={key}
            onClick={() => toggleType(key)}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-95 flex-shrink-0"
            style={{
              background: active ? bg  : "rgba(255,255,255,0.04)",
              border:     `1px solid ${active ? `${color}55` : "var(--border)"}`,
              color:      active ? color : "var(--text-muted)",
            }}
          >
            <Icon size={11} />
            {label}
            {showAutoBadge && (
              <span
                className="ml-0.5 flex items-center gap-0.5 px-1 rounded text-[9px] font-semibold"
                style={{ background: `${color}22`, color }}
              >
                <IconSparkles size={8} />
                auto
              </span>
            )}
          </button>
        );
      })}

      {/* Jet lag toggle — only when travel is selected */}
      <AnimatePresence>
        {dayType === "travel" && (
          <motion.button
            key="jetlag"
            initial={{ opacity: 0, scale: 0.85, width: 0 }}
            animate={{ opacity: 1, scale: 1,    width: "auto" }}
            exit={{   opacity: 0, scale: 0.85, width: 0 }}
            transition={{ duration: 0.18 }}
            onClick={toggleJetlag}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-95 flex-shrink-0 overflow-hidden"
            style={{
              background: jetlag ? "rgba(239,68,68,0.12)"  : "rgba(255,255,255,0.04)",
              border:     `1px solid ${jetlag ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
              color:      jetlag ? "#f87171" : "var(--text-muted)",
            }}
          >
            <span style={{ fontSize: 10 }}>⏱</span>
            Jet lag
            <span className="ml-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: jetlag ? "#f87171" : "rgba(255,255,255,0.15)" }} />
          </motion.button>
        )}
      </AnimatePresence>

      {saving && <IconLoader2 size={11} className="animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
    </div>
  );
}
