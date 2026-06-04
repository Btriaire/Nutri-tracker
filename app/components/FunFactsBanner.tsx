"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconBulb } from "@tabler/icons-react";

const FACTS = [
  { emoji: "🧠", text: "Le cerveau consomme 20 % de l'énergie totale du corps malgré seulement 2 % de la masse corporelle." },
  { emoji: "🥦", text: "Le brocoli contient plus de protéines par calorie que le steak de bœuf." },
  { emoji: "💧", text: "Une déshydratation de seulement 1-2 % affecte déjà les performances cognitives et physiques." },
  { emoji: "🍫", text: "Le cacao brut est l'une des sources les plus riches en magnésium — essentiel pour +300 réactions enzymatiques." },
  { emoji: "🥑", text: "Les avocats sont l'un des rares fruits riches en graisses mono-insaturées, bénéfiques pour le cœur." },
  { emoji: "🌙", text: "Manger dans les 2h avant de dormir peut réduire la qualité du sommeil de 10-15 %." },
  { emoji: "🏃", text: "30 minutes de marche rapide brûlent environ 150 kcal et améliorent l'humeur pendant 12h." },
  { emoji: "🍳", text: "Les œufs contiennent les 9 acides aminés essentiels — l'une des protéines les plus complètes de la nature." },
  { emoji: "🫐", text: "Les myrtilles sont parmi les aliments les plus riches en antioxydants — elles protègent l'ADN cellulaire." },
  { emoji: "⚡", text: "Les glucides complexes libèrent l'énergie sur 4–6h, contre 1–2h pour les sucres simples." },
  { emoji: "🥗", text: "Mâcher lentement (20 fois par bouchée) peut réduire les apports caloriques de 15 % en moyenne." },
  { emoji: "☕", text: "La caféine bloque les récepteurs de l'adénosine, ce qui explique pourquoi elle retarde la fatigue — mais pas le sommeil lui-même." },
  { emoji: "🐟", text: "Les oméga-3 du poisson gras réduisent l'inflammation chronique et sont liés à une meilleure santé cardiovasculaire." },
  { emoji: "🍎", text: "La pectine des pommes nourrit le microbiote intestinal, qui produit à son tour des vitamines B et K." },
  { emoji: "🌿", text: "Le jeûne intermittent de 16h active l'autophagie — le processus de «nettoyage» cellulaire du corps." },
  { emoji: "🦴", text: "95 % du calcium corporel est stocké dans les os, mais il circule en permanence selon les besoins musculaires." },
  { emoji: "🍵", text: "Le thé vert contient de la L-théanine qui combinée à la caféine améliore la concentration sans nervosité." },
  { emoji: "🥩", text: "La viande rouge est l'une des meilleures sources de fer héminique, 3× mieux absorbé que le fer végétal." },
  { emoji: "🌻", text: "Les graines de courge sont parmi les aliments les plus riches en zinc — crucial pour l'immunité et la testostérone." },
  { emoji: "💪", text: "La synthèse protéique musculaire est maximale dans les 2h après l'entraînement — c'est la « fenêtre anabolique »." },
  { emoji: "🍌", text: "Une banane verte a un index glycémique 40 % plus bas qu'une banane mûre — grâce à son amidon résistant." },
  { emoji: "🧬", text: "Le microbiote intestinal contient 10× plus de cellules que le reste du corps et influence l'humeur via l'axe intestin-cerveau." },
];

export default function FunFactsBanner() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * FACTS.length));
  const [direction, setDirection] = useState(1);

  const next = useCallback(() => {
    setDirection(1);
    setIdx((i) => (i + 1) % FACTS.length);
  }, []);

  useEffect(() => {
    const t = setInterval(next, 18000);
    return () => clearInterval(t);
  }, [next]);

  const fact = FACTS[idx];

  return (
    <div className="glass px-3 py-2 mb-3 overflow-hidden relative cursor-pointer"
      onClick={next}
    >
      <div className="flex items-center gap-2 relative z-10">
        <IconBulb size={13} stroke={2} style={{ color: "#fbbf24", flexShrink: 0 }} />
        <p className="text-[10px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: "#fbbf24" }}>
          Le saviez-vous ?
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={idx}
            initial={{ opacity: 0, x: direction * 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-[11px] leading-snug truncate"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="mr-1">{fact.emoji}</span>{fact.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
