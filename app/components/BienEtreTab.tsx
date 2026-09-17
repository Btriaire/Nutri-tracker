"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { IconSparkles } from "@tabler/icons-react";
import MentalHealthWidget from "@/app/components/MentalHealthWidget";
import BreathingGuide from "@/app/components/BreathingGuide";
import MoodTrendChart from "@/app/components/MoodTrendChart";
import PixelWall from "@/app/components/PixelWall";
import type { MoodPoint } from "@/app/components/MoodTrendChart";
import MeditationPlayer from "@/app/components/MeditationPlayer";

// Onglet "Bien-être" de Santé — extrait de HealthClient.tsx (composant deja
// autonome, une seule prop) pour ramener ce fichier sous la barre des
// 2000 lignes.
export default function BienEtreTab({ date }: { date: string }) {
  const [moodPoints, setMoodPoints] = useState<MoodPoint[]>([]);
  const [loadingMood, setLoadingMood] = useState(true);

  useEffect(() => {
    fetch("/api/mental-health?days=30")
      .then(r => r.json())
      .then((d: { points?: MoodPoint[] }) => {
        setMoodPoints(d.points ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingMood(false));
  }, []);

  const hasData = moodPoints.some(p => p.mood != null);
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay },
  });

  return (
    <motion.div {...fade(0.05)} className="space-y-4">
      {/* Daily mood entry */}
      <MentalHealthWidget date={date} />

      {/* Pixel Wall */}
      <div className="glass p-4">
        <PixelWall points={moodPoints} today={date} />
      </div>

      {/* Trend chart */}
      {!loadingMood && hasData && (
        <div className="glass p-4">
          <MoodTrendChart points={moodPoints} />
        </div>
      )}
      {!loadingMood && !hasData && (
        <div className="glass p-4 text-center">
          <p className="text-[13px] flex items-center justify-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <IconSparkles size={13} stroke={1.8} />
            Commence à noter ton humeur pour voir l&apos;évolution sur 30 jours
          </p>
        </div>
      )}

      {/* Breathing */}
      <BreathingGuide />

      {/* Meditation */}
      <div className="glass p-4">
        <MeditationPlayer />
      </div>
    </motion.div>
  );
}
