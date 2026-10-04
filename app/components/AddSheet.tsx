"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconSalad, IconScale, IconBarbell, IconMoodSmile, IconFlame,
  IconSettings2, IconFileText, IconBooks, IconTrendingUp, IconChecklist, IconChartInfographic, IconMicrophone,
} from "@tabler/icons-react";
import Sheet from "./Sheet";

interface Item { href: string; label: string; hint: string; color: string; Icon: ComponentType<{ size?: number; stroke?: number }> }

const ADD: Item[] = [
  { href: "/log",      label: "Repas",             hint: "Recherche, voix, photo, scan",  color: "var(--calories)", Icon: IconSalad },
  { href: "/health",   label: "Poids & mensurations", hint: "Peser, mesurer",             color: "var(--weight)",   Icon: IconScale },
  { href: "/activity", label: "Séance / activité", hint: "Sport, musculation",            color: "var(--steps)",    Icon: IconBarbell },
  { href: "/health",   label: "Humeur & bien-être", hint: "Humeur, sommeil, symptômes",   color: "var(--protein)",  Icon: IconMoodSmile },
];

const GO: Item[] = [
  { href: "/activity", label: "Activité",    hint: "", color: "var(--fiber)",          Icon: IconFlame },
  { href: "/review",   label: "Bilan de la semaine", hint: "", color: "var(--steps)", Icon: IconChecklist },
  { href: "/progress", label: "Progrès",     hint: "", color: "var(--protein)",        Icon: IconTrendingUp },
  { href: "/report/history#podcasts", label: "Podcasts", hint: "", color: "var(--calories)", Icon: IconMicrophone },
  { href: "/report/history", label: "Infographies", hint: "", color: "var(--protein)", Icon: IconChartInfographic },
  { href: "/report",   label: "Rapport",     hint: "", color: "var(--fat)",            Icon: IconFileText },
  { href: "/library",  label: "Bibliothèque", hint: "", color: "var(--carbs)",         Icon: IconBooks },
  { href: "/settings", label: "Réglages",    hint: "", color: "var(--text-secondary)", Icon: IconSettings2 },
];

export default function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Ajouter">
      <div className="grid grid-cols-2 gap-3 mb-5">
        {ADD.map(({ href, label, hint, color, Icon }) => (
          <Link key={label} href={href} onClick={onClose}
            className="flex flex-col gap-2 rounded-2xl p-3.5 min-h-[92px] active:scale-[0.97] transition-transform"
            style={{ background: "var(--surface-active)", borderLeft: `3px solid ${color}` }}>
            <span style={{ color }}><Icon size={24} stroke={1.9} /></span>
            <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{label}</span>
            <span className="text-[12px] leading-tight" style={{ color: "var(--text-secondary)" }}>{hint}</span>
          </Link>
        ))}
      </div>
      <p className="text-[12px] font-medium uppercase tracking-[0.06em] mb-2" style={{ color: "var(--text-muted)" }}>Aller à</p>
      <div className="flex flex-wrap gap-2">
        {GO.map(({ href, label, color, Icon }) => (
          <Link key={label} href={href} onClick={onClose}
            className="flex items-center gap-2 min-h-[44px] px-4 rounded-full text-[13px] font-semibold"
            style={{ background: "var(--surface-active)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>
            <span style={{ color }}><Icon size={16} stroke={2} /></span>{label}
          </Link>
        ))}
      </div>
    </Sheet>
  );
}
