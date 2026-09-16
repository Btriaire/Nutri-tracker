"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { IconCircleCheck, IconLoader2, IconDatabase } from "@tabler/icons-react";

export default function DataSafetyBanner() {
  const [downloading, setDownloading] = useState(false);
  const [done,        setDone]        = useState(false);

  const handleQuickExport = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/export?format=json");
      if (!res.ok) return;
      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const fnMatch = cd.match(/filename="(.+?)"/);
      const filename = fnMatch?.[1] ?? `nutri-tracker-backup.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
      style={{
        background: "linear-gradient(135deg,rgba(52,211,153,0.08),rgba(96,165,250,0.06))",
        border: "1px solid rgba(52,211,153,0.2)",
      }}
    >
      <span className="text-[18px] flex-shrink-0">🔒</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: "#34d399" }}>
          Tes données sont en sécurité
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Stockées dans Firestore · accessibles uniquement par toi
        </p>
      </div>
      <button
        onClick={handleQuickExport}
        disabled={downloading}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
        style={{
          background: done ? "rgba(52,211,153,0.15)" : "rgba(96,165,250,0.12)",
          border: `1px solid ${done ? "rgba(52,211,153,0.3)" : "rgba(96,165,250,0.3)"}`,
          color: done ? "#34d399" : "#60a5fa",
        }}
      >
        {downloading ? (
          <IconLoader2 size={10} className="animate-spin" />
        ) : done ? (
          <><IconCircleCheck size={11} /> OK</>
        ) : (
          <><IconDatabase size={11} /> Sauvegarder</>
        )}
      </button>
    </motion.div>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────
