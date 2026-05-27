"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HouseSimple, Book, ChartLine, Gear, Books, PersonSimpleRun } from "@phosphor-icons/react";

const TABS = [
  { href: "/dashboard", icon: HouseSimple,      label: "Accueil"   },
  { href: "/log",       icon: Book,             label: "Journal"   },
  { href: "/activity",  icon: PersonSimpleRun,  label: "Activité"  },
  { href: "/progress",  icon: ChartLine,        label: "Progrès"   },
  { href: "/settings",  icon: Gear,             label: "Réglages"  },
] as const;

export default function Nav() {
  const path = usePathname();

  return (
    <>
      {/* Bottom nav (mobile) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 flex md:hidden"
        style={{
          background: "rgba(9,9,11,0.85)",
          borderTop: "1px solid var(--border)",
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
                size={20}
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
          background: "rgba(9,9,11,0.6)",
          borderRight: "1px solid var(--border)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-6">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(139,92,246,0.25))",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            🥗
          </div>
          <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            NutriTracker
          </span>
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
              <Icon size={16} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
