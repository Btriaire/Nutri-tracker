"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedLogo from "./AnimatedLogo";

/**
 * Écran d'accueil animé joué à la racine "/" pour tout le monde
 * (connecté ou non), puis redirige vers `target`.
 */
export default function Splash({ target }: { target: string }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    router.prefetch(target);
    const t = setTimeout(() => setGone(true), 2400);
    return () => clearTimeout(t);
  }, [target, router]);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--bg, #0b0b11)" }}>
      <div className="bg-orbs" />
      <div className="bg-grid" />

      <AnimatePresence onExitComplete={() => router.replace(target)}>
        {!gone && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setGone(true)}
          >
            <AnimatedLogo size={132} />

            <div className="mt-6 flex overflow-hidden">
              {"NutriTracker".split("").map((c, i) => (
                <motion.span
                  key={i}
                  className="text-[26px] font-semibold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 1.2 + i * 0.045, ease: [0.16, 1, 0.3, 1] }}
                >
                  {c}
                </motion.span>
              ))}
            </div>

            <motion.p
              className="text-[12px] mt-2"
              style={{ color: "var(--text-muted)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.9, duration: 0.5 }}
            >
              Nutrition · Activité · Progression
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
