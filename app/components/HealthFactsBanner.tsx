"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf } from "@phosphor-icons/react";

// Evidence-based nutrition & health facts (inspired by nutritional medicine research)
const HEALTH_FACTS = [
  { emoji: "🥦", text: "Les légumes crucifères (brocoli, chou, choux de Bruxelles) contiennent du sulforaphane, un composé puissamment anti-inflammatoire et protecteur des cellules." },
  { emoji: "🫒", text: "L'huile d'olive extra vierge contient de l'oléocanthal, un anti-inflammatoire naturel aussi puissant que l'ibuprofène à faible dose." },
  { emoji: "🍇", text: "Le resvératrol des raisins noirs et du vin rouge (avec modération) active les sirtuines, enzymes liées à la longévité cellulaire." },
  { emoji: "🧅", text: "La quercétine des oignons et des pommes est l'un des flavonoïdes les plus puissants pour la protection vasculaire et anti-inflammatoire." },
  { emoji: "🌿", text: "Le curcuma (curcumine) multiplie son efficacité par 20 en présence de poivre noir (pipérine) — une combinaison ancestrale validée par la science." },
  { emoji: "🐟", text: "Les oméga-3 (sardines, maquereaux, saumon sauvage) réduisent les triglycérides et l'inflammation systémique. 2 portions par semaine suffisent." },
  { emoji: "🫐", text: "Les petits fruits rouges (myrtilles, framboises) sont les aliments les plus riches en anthocyanines — protecteurs du cerveau et de la vision." },
  { emoji: "🥑", text: "Les graisses mono-insaturées de l'avocat augmentent l'absorption des caroténoïdes des légumes d'un facteur 3 à 5 quand consommés ensemble." },
  { emoji: "🌰", text: "Les noix de Grenoble sont les seules noix riches en ALA (oméga-3 végétal) — une poignée par jour protège la santé cardiovasculaire." },
  { emoji: "🧄", text: "L'allicine de l'ail (libérée 10 min après écrasement) est un puissant antibactérien naturel et stimulant immunitaire reconnu." },
  { emoji: "🍵", text: "Le thé matcha contient 137× plus d'EGCG (catéchine anti-oxydante) que le thé vert infusé — boire 1 à 2 tasses par jour est optimal." },
  { emoji: "🫘", text: "Les légumineuses (lentilles, pois chiches) fournissent fibres prébiotiques + protéines végétales. Elles nourrissent le microbiote et stabilisent la glycémie." },
  { emoji: "🥕", text: "Les caroténoïdes (carottes, patates douces) sont mieux absorbés cuits avec un corps gras qu'à l'état cru — cuire les carottes double leur biodisponibilité." },
  { emoji: "🍅", text: "Le lycopène de la tomate est 4× plus biodisponible dans la tomate cuite avec de l'huile d'olive que dans la tomate crue." },
  { emoji: "🌾", text: "Les céréales complètes conservent le germe et le son riches en zinc, magnésium et vitamine B. Le raffinage détruit 75% de ces micronutriments." },
  { emoji: "🫚", text: "L'index glycémique d'un aliment est modifié par la cuisson, la maturité et la combinaison avec fibres/graisses — manger des légumes avant les féculents réduit le pic glycémique de 30%." },
  { emoji: "🦠", text: "70% du système immunitaire réside dans l'intestin. Un microbiote diversifié est la première défense contre maladies chroniques et infections." },
  { emoji: "🍋", text: "La vitamine C des agrumes est détruite par la chaleur au-delà de 60°C. Les jus d'agrumes frais doivent être consommés dans les 20 minutes après pressage." },
  { emoji: "🧠", text: "La phosphatidylcholine des œufs est un précurseur essentiel de l'acétylcholine, neurotransmetteur clé de la mémoire et de l'attention." },
  { emoji: "🌱", text: "La fermentation transforme les légumes : la choucroute crue non pasteurisée contient plus de probiotiques vivants que la plupart des compléments." },
  { emoji: "🫀", text: "La bêtaïne de la betterave améliore la méthylation cellulaire et réduit l'homocystéine, un marqueur inflammatoire lié aux maladies cardiaques." },
  { emoji: "🍄", text: "Les champignons exposés au soleil (côté lamelles vers le haut, 20 min) synthétisent de la vitamine D2 utilisable par l'organisme." },
];

export default function HealthFactsBanner() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * HEALTH_FACTS.length));
  const [direction, setDirection] = useState(1);

  const next = useCallback(() => {
    setDirection(1);
    setIdx((i) => (i + 1) % HEALTH_FACTS.length);
  }, []);

  useEffect(() => {
    const t = setInterval(next, 20000);
    return () => clearInterval(t);
  }, [next]);

  const fact = HEALTH_FACTS[idx];

  return (
    <div
      className="px-4 py-3.5 mb-4 overflow-hidden relative rounded-2xl"
      style={{
        background: "linear-gradient(135deg, rgba(52,211,153,0.07) 0%, rgba(16,185,129,0.04) 100%)",
        border: "1px solid rgba(52,211,153,0.2)",
        minHeight: "82px",
        cursor: "pointer",
      }}
      onClick={next}
    >
      {/* Background leaf glow */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ background: "radial-gradient(ellipse at 10% 50%, #34d399 0%, transparent 70%)" }} />

      <div className="flex items-start gap-3 relative z-10">
        <div className="flex-shrink-0 mt-0.5">
          <Leaf size={14} weight="fill" style={{ color: "#34d399" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold mb-1 uppercase tracking-wider" style={{ color: "#34d399" }}>
            Nutrition &amp; Santé
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={idx}
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="text-[12px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="mr-1.5">{fact.emoji}</span>{fact.text}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1 mt-2.5">
        {Array.from({ length: Math.min(HEALTH_FACTS.length, 8) }).map((_, i) => {
          const dotIdx = Math.floor((idx / HEALTH_FACTS.length) * 8);
          return (
            <div key={i} className="rounded-full transition-all"
              style={{
                width:      i === dotIdx ? "12px" : "4px",
                height:     "4px",
                background: i === dotIdx ? "#34d399" : "rgba(52,211,153,0.2)",
              }} />
          );
        })}
      </div>
    </div>
  );
}
