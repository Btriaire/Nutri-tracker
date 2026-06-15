"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/app/lib/firebase-client";
import {
  IconLayoutDashboard, IconNotebook, IconHeartbeat,
  IconFlame, IconTrendingUp, IconSettings2, IconLogout,
} from "@tabler/icons-react";

const TABS = [
  { href: "/dashboard", Icon: IconLayoutDashboard, label: "Accueil",  color: "#f97316", bg: "rgba(249,115,22,0.14)" },
  { href: "/log",       Icon: IconNotebook,        label: "Journal",  color: "#3b82f6", bg: "rgba(59,130,246,0.14)" },
  { href: "/health",    Icon: IconHeartbeat,       label: "Santé",    color: "#f43f5e", bg: "rgba(244,63,94,0.14)"  },
  { href: "/activity",  Icon: IconFlame,           label: "Activité", color: "#34d399", bg: "rgba(52,211,153,0.14)" },
  { href: "/progress",  Icon: IconTrendingUp,      label: "Progrès",  color: "#a78bfa", bg: "rgba(167,139,250,0.14)"},
  { href: "/settings",  Icon: IconSettings2,       label: "Réglages", color: "#94a3b8", bg: "rgba(148,163,184,0.12)"},
] as const;

export default function Nav() {
  const path   = usePathname();
  const router = useRouter();
  const [photoUrl,    setPhotoUrl]    = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await signOut(getClientAuth()); } catch {}
    router.push("/login");
  }, [router]);

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
      {/* Top logo bar (mobile only) */}
      <div className="fixed top-0 inset-x-0 z-50 flex md:hidden items-center justify-center px-4"
        style={{
          background: "var(--nav-bg)",
          borderBottom: "1px solid var(--nav-border)",
          backdropFilter: "blur(16px)",
          height: "48px",
        }}>
        <Image src="/logo.png" alt="Nutri-Tracker" width={390} height={103} className="h-10 w-auto" priority />
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
        {TABS.map(({ href, Icon, label, color, bg }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
              <span className="text-[9.5px] font-medium leading-none"
                style={{ color: active ? color : "var(--text-muted)" }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Side nav (desktop) */}
      <nav
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col w-[220px] py-6 px-3 gap-0.5"
        style={{
          background: "var(--nav-bg)",
          borderRight: "1px solid var(--nav-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center px-2 mb-6">
          <Image src="/logo.png" alt="Nutri-Tracker" width={390} height={103}
            className="w-full max-w-[180px] h-auto" priority />
        </div>

        {TABS.map(({ href, Icon, label, color, bg }) => {
          const active = path.startsWith(href);
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all"
              style={{ background: active ? bg : "transparent", color: active ? color : "var(--text-secondary)" }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)" }}>
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
                  <div className="w-full h-full flex items-center justify-center text-[11px] font-semibold"
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
              onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
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
