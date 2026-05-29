"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/app/lib/firebase-client";
import { HouseSimple, Book, ChartLine, Gear, PersonSimpleRun, Heart, SignOut, FilePdf } from "@phosphor-icons/react";

const TABS = [
  { href: "/dashboard", icon: HouseSimple,      label: "Accueil"   },
  { href: "/log",       icon: Book,             label: "Journal"   },
  { href: "/health",    icon: Heart,            label: "Santé"     },
  { href: "/activity",  icon: PersonSimpleRun,  label: "Activité"  },
  { href: "/progress",  icon: ChartLine,        label: "Progrès"   },
  { href: "/report",    icon: FilePdf,          label: "Rapport"   },
  { href: "/settings",  icon: Gear,             label: "Réglages"  },
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

  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: { photoUrl?: string; displayName?: string }) => {
        if (d.photoUrl)    setPhotoUrl(d.photoUrl);
        if (d.displayName) setDisplayName(d.displayName);
      })
      .catch(() => {});
  }, [path]);

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
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
              style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              <Icon
                size={22}
                weight={active ? "fill" : "regular"}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                {label}
              </span>
              {active && (
                <span
                  className="absolute bottom-0 w-4 h-0.5 rounded-full"
                  style={{ background: "var(--calories)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Side nav (desktop) */}
      <nav
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col w-[220px] py-6 px-3 gap-1"
        style={{
          background: "var(--nav-bg)",
          borderRight: "1px solid var(--nav-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center px-2 mb-6">
          <Image
            src="/logo.png"
            alt="Nutri-Tracker"
            width={390}
            height={103}
            className="w-full max-w-[180px] h-auto"
            priority
          />
        </div>

        {TABS.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-all"
              style={{
                background: active ? "var(--surface-active)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                border: active ? "1px solid var(--border-strong)" : "1px solid transparent",
              }}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}

        {/* Profile + logout at bottom */}
        <div className="mt-auto pt-3" style={{ borderTop: "1px solid var(--nav-border)" }}>
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all flex-1 min-w-0"
              style={{
                background: path.startsWith("/settings") ? "var(--surface-active)" : "transparent",
                border: "1px solid transparent",
              }}
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
            <button
              onClick={handleLogout}
              title="Se déconnecter"
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
