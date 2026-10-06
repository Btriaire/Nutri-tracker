"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/app/lib/firebase-client";
import {
  IconLayoutDashboard, IconNotebook, IconHeartbeat,
  IconFlame, IconTrendingUp, IconSettings2, IconLogout, IconPlus,
} from "@tabler/icons-react";
import AddSheet from "./AddSheet";
import { playNavSound } from "@/app/lib/sounds";

const TABS = [
  { href: "/dashboard", Icon: IconLayoutDashboard, label: "Aujourd'hui", color: "var(--calories)", bg: "color-mix(in srgb, var(--calories) 20%, transparent)" },
  { href: "/log",       Icon: IconNotebook,        label: "Journal",  color: "var(--info)",     bg: "color-mix(in srgb, var(--info) 20%, transparent)" },
  { href: "/health",    Icon: IconHeartbeat,       label: "Santé",    color: "var(--danger)",   bg: "color-mix(in srgb, var(--danger) 20%, transparent)" },
  { href: "/activity",  Icon: IconFlame,           label: "Activité", color: "var(--fiber)",    bg: "color-mix(in srgb, var(--fiber) 20%, transparent)" },
  { href: "/progress",  Icon: IconTrendingUp,      label: "Progrès",  color: "var(--protein)",  bg: "color-mix(in srgb, var(--protein) 20%, transparent)" },
  { href: "/settings",  Icon: IconSettings2,       label: "Réglages", color: "var(--text-secondary)", bg: "var(--surface-active)" },
] as const;

// Barre mobile : 4 onglets + bouton "+" central. Activite et Reglages restent
// atteignables via la feuille "Ajouter" ("Aller a").
const MOBILE_HREFS = new Set(["/dashboard", "/log", "/health", "/progress"]);

// La barre du haut affichait le logo sur les 48px les plus precieux de
// l'ecran, a chaque page, alors que l'utilisateur sait deja quelle appli il
// ouvre. Elle indique desormais OU il se trouve. Plus long prefixe gagnant.
const TITLES: [string, string][] = [
  ["/activity/sleep",   "Sommeil"],
  ["/activity/steps",   "Pas"],
  ["/health/face-scan", "Scan du visage"],
  ["/health/eye",       "Œil"],
  ["/report/history",   "Historique"],
  ["/review",           "Bilan de la semaine"],
  ["/log",              "Journal"],
  ["/health",           "Santé"],
  ["/activity",         "Activité"],
  ["/progress/glycemie", "Glycémie"],
  ["/progress",         "Progrès"],
  ["/settings",         "Réglages"],
  ["/dashboard",        "Tableau de bord"],
  ["/cardio",           "Cardio"],
  ["/food-bank",        "Aliments"],
  ["/library",          "Bibliothèque"],
  ["/report",           "Rapport"],
  ["/repartition",      "Répartition"],
];

function pageTitle(path: string): string {
  let best = "";
  let title = "Nutri-Tracker";
  for (const [prefix, label] of TITLES) {
    if (path.startsWith(prefix) && prefix.length > best.length) { best = prefix; title = label; }
  }
  return title;
}

export default function Nav() {
  const path   = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const [photoUrl,    setPhotoUrl]    = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await signOut(getClientAuth()); } catch {}
    // Hard navigation (not router.push) — ensures the cookie-clearing response is
    // durably committed before the new page loads, same reasoning as the login redirect.
    window.location.href = "/login";
  }, []);

  // Fetch once on mount — no need to re-fetch on every route change
  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: { photoUrl?: string; displayName?: string }) => {
        if (d.photoUrl)    setPhotoUrl(d.photoUrl);
        if (d.displayName) setDisplayName(d.displayName);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Barre du haut (mobile) — titre de section, pas le logo */}
      <div className="fixed top-0 inset-x-0 z-50 flex md:hidden items-center justify-between px-4"
        style={{
          background: "var(--nav-bg)",
          borderBottom: "1px solid var(--nav-border)",
          backdropFilter: "blur(16px)",
          height: "48px",
        }}>
        <span className="text-[17px] font-semibold tracking-tight truncate"
          style={{ color: "var(--text-primary)" }}>
          {pageTitle(path)}
        </span>
        <Link href="/dashboard" aria-label="Accueil Nutri-Tracker" className="flex items-center flex-shrink-0 min-h-[44px] opacity-70 active:opacity-100">
          <Image src="/logo.png" alt="Nutri-Tracker" width={390} height={103} className="h-6 w-auto" priority />
        </Link>
      </div>

      {/* Bottom nav (mobile) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 flex md:hidden"
        style={{
          background: "var(--nav-bg)",
          borderTop: "1px solid var(--nav-border)",
          backdropFilter: "blur(16px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {TABS.filter(t => MOBILE_HREFS.has(t.href)).flatMap(({ href, Icon, label, color, bg }, i) => {
          const active = path.startsWith(href);
          const tab = (
            <Link
              key={href}
              href={href}
              onClick={() => { if (!active) playNavSound(); }}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                style={{
                  background: active ? bg : "transparent",
                  transform: active ? "scale(1.08)" : "scale(1)",
                }}
              >
                <Icon size={22} stroke={active ? 2.2 : 1.6}
                  style={{ color: active ? color : "var(--text-muted)" }} />
              </div>
              <span className="text-[12px] font-medium leading-none"
                style={{ color: active ? color : "var(--text-muted)" }}>
                {label}
              </span>
            </Link>
          );
          return i === 2 ? [(
            <div key="fab" className="flex-1 flex items-center justify-center">
              <button type="button" onClick={() => setAddOpen(true)} aria-label="Ajouter"
                className="-mt-6 flex items-center justify-center w-14 h-14 rounded-full active:scale-95 transition-transform"
                style={{
                  background: "linear-gradient(135deg, var(--protein), var(--steps))",
                  color: "var(--bg)",
                  boxShadow: "0 0 28px color-mix(in srgb, var(--protein) 55%, transparent)",
                }}>
                <IconPlus size={28} stroke={2.6} />
              </button>
            </div>
          ), tab] : [tab];
        })}
      </nav>
      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Side nav (desktop) */}
      <nav
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col w-[220px] py-6 px-3 gap-0.5"
        style={{
          background: "var(--nav-bg)",
          borderRight: "1px solid var(--nav-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <Link href="/dashboard" className="flex items-center px-2 mb-6">
          <Image src="/logo.png" alt="Nutri-Tracker" width={390} height={103}
            className="w-full max-w-[180px] h-auto" priority />
        </Link>

        {TABS.map(({ href, Icon, label, color, bg }) => {
          const active = path.startsWith(href);
          return (
            <Link key={href} href={href}
              onClick={() => { if (!active) playNavSound(); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all"
              style={{ background: active ? bg : "transparent", color: active ? color : "var(--text-secondary)" }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: active ? "var(--layer-3)" : "var(--layer-1)" }}>
                <Icon size={17} stroke={active ? 2.2 : 1.6}
                  style={{ color: active ? color : "var(--text-muted)" }} />
              </div>
              {label}
            </Link>
          );
        })}

        <div className="mt-auto pt-3" style={{ borderTop: "1px solid var(--nav-border)" }}>
          <div className="flex items-center gap-1">
            <Link href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all flex-1 min-w-0"
              style={{ background: path.startsWith("/settings") ? "rgba(148,163,184,0.1)" : "transparent" }}
            >
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: "1.5px solid var(--border-strong)" }}>
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[12px] font-semibold"
                    style={{ background: "rgba(249,115,22,0.15)", color: "var(--calories)" }}>
                    {displayName ? displayName[0].toUpperCase() : "N"}
                  </div>
                )}
              </div>
              <span className="text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>
                {displayName ? displayName.split(" ")[0] : "Mon profil"}
              </span>
            </Link>
            <button onClick={handleLogout} title="Se déconnecter"
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <IconLogout size={16} stroke={1.8} />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
