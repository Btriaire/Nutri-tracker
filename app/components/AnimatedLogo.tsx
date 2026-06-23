"use client";

import { motion } from "framer-motion";

interface Props {
  size?:        number;   // taille en px
  play?:        boolean;  // rejoue l'animation d'apparition (défaut true)
  orbit?:       boolean;  // point qui orbite en continu (défaut true)
  className?:   string;
}

/**
 * Logo NutriTracker animé (SVG).
 * - Anneau de progression dégradé orange→violet qui se dessine (suivi quotidien)
 * - Feuille verte qui éclot au centre (nutrition)
 * - Point qui orbite sur l'anneau (activité / progression)
 * - Légère respiration continue
 */
export default function AnimatedLogo({ size = 96, play = true, orbit = true, className }: Props) {
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    show:   { pathLength: 1, opacity: 1 },
  };

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size, display: "inline-block" }}
      animate={{ scale: [1, 1.035, 1] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        initial={play ? "hidden" : "show"}
        animate="show"
        fill="none"
      >
        <defs>
          <linearGradient id="nt-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#f97316" />
            <stop offset="55%"  stopColor="#fb7185" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="nt-leaf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4ade80" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="nt-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* anneau de fond */}
        <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />

        {/* anneau de progression qui se dessine */}
        <motion.circle
          cx="50" cy="50" r="42"
          stroke="url(#nt-ring)" strokeWidth="6" strokeLinecap="round"
          filter="url(#nt-glow)"
          style={{ rotate: -90, transformOrigin: "50px 50px" }}
          variants={draw}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />

        {/* feuille — corps */}
        <motion.path
          d="M50 30 C64 42 64 58 50 70 C36 58 36 42 50 30 Z"
          fill="url(#nt-leaf)"
          style={{ transformOrigin: "50px 50px" }}
          initial={play ? { scale: 0, opacity: 0, rotate: -25 } : false}
          animate={{ scale: 1, opacity: 1, rotate: -8 }}
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1], delay: 0.9 }}
        />

        {/* feuille — nervure centrale */}
        <motion.path
          d="M50 35 L50 66"
          stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round"
          style={{ transformOrigin: "50px 50px", rotate: -8 }}
          variants={draw}
          transition={{ duration: 0.5, ease: "easeOut", delay: 1.45 }}
        />

        {/* point qui orbite sur l'anneau */}
        {orbit && (
          <motion.g
            style={{ transformOrigin: "50px 50px" }}
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 360, opacity: 1 }}
            transition={{
              rotate:  { duration: 7, repeat: Infinity, ease: "linear" },
              opacity: { duration: 0.4, delay: 1.6 },
            }}
          >
            <circle cx="50" cy="8" r="3.4" fill="#fb923c" filter="url(#nt-glow)" />
          </motion.g>
        )}
      </motion.svg>
    </motion.div>
  );
}
