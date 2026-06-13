import type { Metadata } from "next";

export const metadata: Metadata = { title: "NutriTracker — PC" };

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mode PC badge — fixed top-right of content area */}
      <div
        className="fixed top-2 right-2 z-[60] flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium select-none"
        style={{
          background: "rgba(15,15,20,0.80)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        🖥️ Mode PC
        <a
          href="/dashboard"
          className="ml-1 px-2 py-0.5 rounded text-[10px] hover:opacity-100 opacity-55 transition-opacity"
          style={{ border: "1px solid rgba(255,255,255,0.14)" }}
        >
          ← Mobile
        </a>
      </div>
      <div className="dsk-full">{children}</div>
    </>
  );
}
