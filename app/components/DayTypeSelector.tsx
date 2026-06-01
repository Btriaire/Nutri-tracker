"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconBriefcase, IconSofa, IconPlaneInflight, IconLoader2 } from "@tabler/icons-react";
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

interface Props {
  date:          string;
  initialType?:  DayType;
  initialJetlag?: boolean;
}

export default function DayTypeSelector({ date, initialType, initialJetlag }: Props) {
  const [dayType, setDayType] = useState<DayType | null>(initialType ?? null);
  const [jetlag,  setJetlag]  = useState(initialJetlag ?? false);
  const [saving,  setSaving]  = useState(false);

  async function save(type: DayType | null, jl: boolean) {
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
    setDayType(next);
    const jl = next === "travel" ? jetlag : false;
    save(next, jl);
  }

  function toggleJetlag() {
    const next = !jetlag;
    setJetlag(next);
    save(dayType, next);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* 3 type chips */}
      {DAY_TYPES.map(({ key, label, Icon, color, bg }) => {
        const active = dayType === key;
        return (
          <button
            key={key}
            onClick={() => toggleType(key)}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-95 flex-shrink-0"
            style={{
              background:  active ? bg   : "rgba(255,255,255,0.04)",
              border:      `1px solid ${active ? `${color}55` : "var(--border)"}`,
              color:       active ? color : "var(--text-muted)",
            }}
          >
            <Icon size={11} />
            {label}
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
            {/* Dot indicator */}
            <span className="ml-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: jetlag ? "#f87171" : "rgba(255,255,255,0.15)" }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Saving spinner */}
      {saving && <IconLoader2 size={11} className="animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
    </div>
  );
}
