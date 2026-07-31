"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { IconCircleCheck, IconLoader2, IconMoodSmile, IconAlertTriangle } from "@tabler/icons-react";

interface Props {
  valid: boolean;
  programId: string;
  programLabel: string;
  durationMin: number;
}

export default function ImportMeditationClient({ valid, programId, programLabel, durationMin }: Props) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function confirm() {
    setState("saving");
    try {
      const res = await fetch("/api/meditation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: `halcyon-${programId}`,
          programLabel,
          durationMin,
        }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="bg-orbs" />
      <div className="bg-grid" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[360px]"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <IconMoodSmile size={40} style={{ color: "var(--text-primary)" }} />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Importer une séance
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            Depuis Halcyon-PaLaMa
          </p>
        </div>

        <div className="glass-strong p-6 space-y-4">
          {!valid ? (
            <div className="flex flex-col items-center gap-2 text-center py-4">
              <IconAlertTriangle size={28} style={{ color: "var(--text-muted)" }} />
              <p className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                Lien d&apos;import invalide ou incomplet.
              </p>
            </div>
          ) : state === "done" ? (
            <div className="flex flex-col items-center gap-2 text-center py-4">
              <IconCircleCheck size={32} style={{ color: "var(--text-primary)" }} />
              <p className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                Séance importée dans ton journal méditation.
              </p>
              <Link
                href="/hub"
                className="mt-2 text-[13px] underline"
                style={{ color: "var(--text-muted)" }}
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center py-2">
                <p className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {programLabel}
                </p>
                <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {durationMin} min
                </p>
              </div>

              {state === "error" && (
                <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
                  Échec de l&apos;enregistrement — réessaie, ou vérifie que tu es bien connecté·e.
                </p>
              )}

              <button
                type="button"
                onClick={confirm}
                disabled={state === "saving"}
                className="w-full flex items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-all"
                style={{
                  height: "40px",
                  background: "var(--text-primary)",
                  color: "var(--bg-primary, #14161c)",
                }}
              >
                {state === "saving" ? (
                  <IconLoader2 size={14} className="animate-spin" />
                ) : (
                  "Importer cette séance"
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
