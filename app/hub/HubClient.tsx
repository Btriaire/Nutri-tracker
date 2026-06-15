"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

// ─── Animated SVG : Journal ───────────────────────────────────────────────────
function JournalSVG() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" overflow="visible">
      <defs>
        <linearGradient id="j-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* Bowl */}
      <path d="M36,62 Q32,108 80,116 Q128,108 124,62 Z"
        fill="url(#j-bowl)" stroke="#f97316" strokeWidth="1.8" strokeOpacity="0.6" />
      {/* Rim */}
      <ellipse cx="80" cy="62" rx="44" ry="8" fill="none"
        stroke="#f97316" strokeWidth="1.8" strokeOpacity="0.5" />

      {/* Fork (left) */}
      <g stroke="#f97316" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round">
        <line x1="52" y1="30" x2="52" y2="60" />
        <line x1="49" y1="30" x2="49" y2="44" />
        <line x1="55" y1="30" x2="55" y2="44" />
        <path d="M49,44 Q52,50 55,44" fill="none" />
      </g>

      {/* Spoon (right) */}
      <g stroke="#f97316" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round">
        <line x1="108" y1="52" x2="108" y2="60" />
        <ellipse cx="108" cy="42" rx="5" ry="8" stroke="#f97316" strokeOpacity="0.55" />
      </g>

      {/* Steam strands */}
      {[[-12, 0], [0, -6], [12, 0]].map(([dx, delay], i) => (
        <motion.path
          key={i}
          d={`M${80 + dx},56 Q${80 + dx - 5},46 ${80 + dx},36 Q${80 + dx + 5},26 ${80 + dx},18`}
          fill="none" stroke="#f97316" strokeWidth="1.6" strokeLinecap="round"
          strokeOpacity="0.45"
          animate={{ opacity: [0, 0.7, 0], y: [0, -8, -14] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: delay * -1 / 6 }}
        />
      ))}

      {/* Sparkles */}
      {[[130, 30], [22, 45], [140, 90], [18, 95]].map(([x, y], i) => (
        <motion.g key={i}
          animate={{ scale: [0.6, 1.2, 0.6], opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        >
          <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke="#f97316" strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="#f97316" strokeWidth="1.2" strokeOpacity="0.6" />
        </motion.g>
      ))}
    </svg>
  );
}

// ─── Animated SVG : Activité ──────────────────────────────────────────────────
function ActiviteSVG() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" overflow="visible">
      <defs>
        <linearGradient id="a-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
        </linearGradient>
        <filter id="a-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background grid dots */}
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => (
          <circle key={`${row}-${col}`}
            cx={16 + col * 19} cy={100 + row * 12 - 24}
            r="1" fill="#34d399" fillOpacity="0.12" />
        ))
      )}

      {/* Flame shape */}
      <motion.path
        d="M80,118 C58,118 46,102 50,85 C54,70 62,72 62,60 C62,48 70,38 80,28 C80,28 78,46 86,52 C92,56 96,62 96,72 C102,64 100,52 96,44 C108,56 114,72 110,88 C106,104 96,118 80,118 Z"
        fill="url(#a-flame)" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.7"
        filter="url(#a-glow)"
        animate={{ scaleY: [1, 1.04, 0.97, 1.02, 1], scaleX: [1, 0.97, 1.02, 0.98, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "80px 118px" }}
      />

      {/* ECG line across flame */}
      <motion.path
        d="M10,80 L34,80 L42,56 L50,104 L58,80 L70,80 L78,48 L86,108 L94,80 L106,80 L114,62 L122,80 L150,80"
        fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        strokeOpacity="0.9"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 1, 1, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.7, 1] }}
      />

      {/* Pulse dot */}
      <motion.circle cx="94" cy="80" r="4" fill="#34d399"
        animate={{ scale: [0, 1.4, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 1.6 }}
        style={{ transformOrigin: "94px 80px" }}
      />
    </svg>
  );
}

// ─── Animated SVG : Progrès ───────────────────────────────────────────────────
function ProgresSVG() {
  const bars = [
    { x: 26, h: 52, color: "#a78bfa" },
    { x: 58, h: 80, color: "#a78bfa" },
    { x: 90, h: 64, color: "#a78bfa" },
    { x: 122, h: 96, color: "#c4b5fd" },
  ];
  const baseline = 118;

  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" overflow="visible">
      <defs>
        <linearGradient id="p-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Axis */}
      <line x1="16" y1={baseline} x2="150" y2={baseline}
        stroke="rgba(167,139,250,0.2)" strokeWidth="1" />
      <line x1="16" y1="20" x2="16" y2={baseline}
        stroke="rgba(167,139,250,0.2)" strokeWidth="1" />

      {/* Bars */}
      {bars.map((b, i) => (
        <motion.rect
          key={i}
          x={b.x - 14} y={baseline}
          width="28" height={0}
          rx="4"
          fill={`url(#p-bar)`}
          stroke={b.color} strokeWidth="1" strokeOpacity="0.6"
          animate={{ y: baseline - b.h, height: b.h }}
          transition={{ duration: 0.8, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 3 }}
        />
      ))}

      {/* Trend line */}
      <motion.path
        d={`M${bars[0].x},${baseline - bars[0].h} L${bars[1].x},${baseline - bars[1].h} L${bars[2].x},${baseline - bars[2].h} L${bars[3].x},${baseline - bars[3].h}`}
        fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="4 3" strokeOpacity="0.7"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.8 }}
      />

      {/* Star (top right) */}
      <motion.polygon
        points="136,22 138.5,30 146,30 140,35 142,43 136,38 130,43 132,35 126,30 133.5,30"
        fill="#a78bfa" fillOpacity="0.8"
        stroke="#c4b5fd" strokeWidth="0.8"
        animate={{ scale: [0.85, 1.15, 0.85], rotate: [0, 15, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "136px 32px" }}
      />
    </svg>
  );
}

// ─── Animated SVG : Santé ─────────────────────────────────────────────────────
function SanteSVG() {
  return (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" overflow="visible">
      <defs>
        <linearGradient id="h-heart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.3" />
        </linearGradient>
        <filter id="h-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Heart */}
      <motion.path
        d="M80,108 C48,88 30,70 30,52 C30,38 40,28 54,28 C63,28 71,33 80,42 C89,33 97,28 106,28 C120,28 130,38 130,52 C130,70 112,88 80,108 Z"
        fill="url(#h-heart)" stroke="#f43f5e" strokeWidth="1.8" strokeOpacity="0.8"
        filter="url(#h-glow)"
        animate={{ scale: [1, 1.06, 0.97, 1.04, 1, 1, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1] }}
        style={{ transformOrigin: "80px 68px" }}
      />

      {/* ECG across heart */}
      <motion.path
        d="M18,68 L38,68 L46,48 L54,86 L62,68 L72,68 L80,42 L88,90 L96,68 L106,68 L114,52 L122,68 L142,68"
        fill="none" stroke="#fda4af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        strokeOpacity="0.9"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 1, 1, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.7, 1] }}
      />

      {/* Medical cross */}
      <rect x="74" y="18" width="12" height="4" rx="2" fill="#f43f5e" fillOpacity="0.5" />
      <rect x="78" y="14" width="4" height="12" rx="2" fill="#f43f5e" fillOpacity="0.5" />

      {/* Corner pulse dots */}
      {[[22, 30], [138, 30], [22, 110], [138, 110]].map(([cx, cy], i) => (
        <motion.circle key={i} cx={cx} cy={cy} r="3"
          fill="#f43f5e" fillOpacity="0.4"
          animate={{ scale: [0.5, 1.3, 0.5], opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
    </svg>
  );
}

// ─── Card config ──────────────────────────────────────────────────────────────
const CARDS = [
  {
    href:    "/log",
    label:   "JOURNAL",
    sub:     "Repas & calories",
    SVG:     JournalSVG,
    color:   "#f97316",
    glow:    "rgba(249,115,22,0.18)",
    border:  "rgba(249,115,22,0.25)",
    bg:      "rgba(249,115,22,0.07)",
  },
  {
    href:    "/activity",
    label:   "ACTIVITÉ",
    sub:     "Mouvement & brûlé",
    SVG:     ActiviteSVG,
    color:   "#34d399",
    glow:    "rgba(52,211,153,0.18)",
    border:  "rgba(52,211,153,0.25)",
    bg:      "rgba(52,211,153,0.07)",
  },
  {
    href:    "/progress",
    label:   "PROGRÈS",
    sub:     "Tendances & courbes",
    SVG:     ProgresSVG,
    color:   "#a78bfa",
    glow:    "rgba(167,139,250,0.18)",
    border:  "rgba(167,139,250,0.25)",
    bg:      "rgba(167,139,250,0.07)",
  },
  {
    href:    "/health",
    label:   "SANTÉ",
    sub:     "Vitaux & bien-être",
    SVG:     SanteSVG,
    color:   "#f43f5e",
    glow:    "rgba(244,63,94,0.18)",
    border:  "rgba(244,63,94,0.25)",
    bg:      "rgba(244,63,94,0.07)",
  },
] as const;

// ─── Hub Card ─────────────────────────────────────────────────────────────────
function HubCard({ card, index }: { card: typeof CARDS[number]; index: number }) {
  const router = useRouter();

  return (
    <motion.button
      onClick={() => router.push(card.href)}
      className="relative flex flex-col items-center justify-center gap-3 rounded-3xl overflow-hidden w-full h-full"
      style={{
        background:  card.bg,
        border:      `1px solid ${card.border}`,
        cursor:      "pointer",
      }}
      initial={{ opacity: 0, scale: 0.88, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.1 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{
        scale: 1.03,
        boxShadow: `0 0 40px ${card.glow}, 0 8px 32px rgba(0,0,0,0.3)`,
        borderColor: card.color,
      }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Ambient glow blob */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 60%, ${card.glow} 0%, transparent 70%)`,
        }}
      />

      {/* SVG illustration */}
      <div className="relative z-10 flex items-center justify-center" style={{ height: "140px" }}>
        <card.SVG />
      </div>

      {/* Label */}
      <div className="relative z-10 text-center pb-1">
        <p className="text-[17px] font-black tracking-widest" style={{ color: card.color }}>
          {card.label}
        </p>
        <p className="text-[11px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
          {card.sub}
        </p>
      </div>
    </motion.button>
  );
}

// ─── Hub Client ───────────────────────────────────────────────────────────────
export default function HubClient() {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "var(--bg)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Image src="/logo.png" alt="NutriTracker" width={160} height={42} className="h-8 w-auto" priority />
        <button
          onClick={() => router.push("/dashboard")}
          className="text-[11px] font-medium px-3 py-1.5 rounded-xl transition-all"
          style={{
            background: "rgba(255,255,255,0.06)",
            border:     "1px solid rgba(255,255,255,0.1)",
            color:      "var(--text-muted)",
          }}
        >
          Dashboard →
        </button>
      </motion.div>

      {/* 2×2 Grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-4 min-h-0">
        {CARDS.map((card, i) => (
          <HubCard key={card.href} card={card} index={i} />
        ))}
      </div>
    </div>
  );
}
