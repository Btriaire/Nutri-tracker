"use client";

import type { ReactNode } from "react";

// Icone SVG dessinee a la main par type d'activite (Google Fit activityType)
// — extrait de ActivityClient.tsx.
export default function ActivitySVGIcon({ type, color: c, size = 28 }: { type: number; color: string; size?: number }) {
  const sw = 1.7;
  const lc = "round" as const;
  const lj = "round" as const;
  const p = { stroke: c, strokeWidth: sw, strokeLinecap: lc, strokeLinejoin: lj, fill: "none" as const };

  let icon: ReactNode;
  switch (true) {
    case type === 1 || type === 8: // Running
      icon = <>
        <circle cx="14.5" cy="3.8" r="1.8" fill={c}/>
        <path d="M13.5 5.8L11 13" {...p}/>
        <path d="M13 8l4.5 2.5" {...p}/>
        <path d="M12.5 8.5L9 7.5" {...p}/>
        <path d="M11 13l4 5 3.5 1" {...p}/>
        <path d="M11 13L8 18 5 17.5" {...p}/>
      </>;
      break;
    case type === 7 || type === 2: // Cycling
      icon = <>
        <circle cx="6.5" cy="17" r="4" {...p}/>
        <circle cx="17.5" cy="17" r="4" {...p}/>
        <path d="M6.5 17l5.5-9h3l4 9" {...p}/>
        <path d="M12 8l-1.5-3" {...p}/>
        <path d="M10.5 5h3" {...p}/>
      </>;
      break;
    case type === 17 || type === 60: // Weights
      icon = <>
        <rect x="2" y="9" width="4" height="6" rx="1.5" fill={c} opacity="0.55"/>
        <rect x="18" y="9" width="4" height="6" rx="1.5" fill={c} opacity="0.55"/>
        <rect x="5.5" y="10.5" width="2.5" height="3" rx="0.5" fill={c} opacity="0.35"/>
        <rect x="16" y="10.5" width="2.5" height="3" rx="0.5" fill={c} opacity="0.35"/>
        <line x1="8" y1="12" x2="16" y2="12" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      </>;
      break;
    case type === 46 || type === 79: // Walking
      icon = <>
        <circle cx="13" cy="4" r="1.8" fill={c}/>
        <path d="M12.5 5.8L11.5 12" {...p}/>
        <path d="M12.5 7l3.5 2.5" {...p}/>
        <path d="M12 8L9 10" {...p}/>
        <path d="M11.5 12L13 17 15 19" {...p}/>
        <path d="M11.5 12L9.5 16.5 7 17.5" {...p}/>
      </>;
      break;
    case type === 93: // Swimming
      icon = <>
        <path d="M3 10c1.5-2 3 2 5 0s3-2 5 0 3 2 5-.5" {...p}/>
        <path d="M3 15c1.5-2 3 2 5 0s3-2 5 0 3 2 5-.5" {...p}/>
        <circle cx="17" cy="5" r="1.5" fill={c}/>
        <path d="M17 6.5L15 10 12 9" {...p}/>
        <path d="M15.5 10.5l3 .5" {...p}/>
      </>;
      break;
    case type === 82: // Yoga
      icon = <>
        <circle cx="12" cy="4" r="2" fill={c}/>
        <path d="M12 6v4" {...p}/>
        <path d="M12 10L7 14M12 10L17 14" {...p}/>
        <path d="M7 14L5 16.5" {...p}/>
        <path d="M17 14L19 16.5" {...p}/>
        <path d="M8 16l4 5 4-5" {...p}/>
      </>;
      break;
    case type === 9: // HIIT / Flame
      icon = <>
        <path d="M12 2c0 0-7 7-7 12a7 7 0 0 0 14 0c0-3.5-2.5-6-2.5-6-1 2.5-2.5 4-5.5 4 3-4 3-8 1-10z"
          fill={c} opacity="0.22" stroke={c} strokeWidth="1.4" strokeLinejoin={lj}/>
        <path d="M12 9c0 0-3 3.5-3 6a3 3 0 0 0 6 0c0-2.5-3-6-3-6z" fill={c} opacity="0.55"/>
      </>;
      break;
    case type === 45: // Football
      icon = <>
        <circle cx="12" cy="12" r="8" {...p}/>
        <path d="M12 4l3 3-1.5 4h-3L9 7z" fill={c} opacity="0.35" stroke={c} strokeWidth="1.2"/>
        <path d="M4.7 9.5l2.8 1-.5 4-2.5 2.5" stroke={c} strokeWidth="1.2" strokeLinecap={lc} fill="none"/>
        <path d="M19.3 9.5l-2.8 1 .5 4 2.5 2.5" stroke={c} strokeWidth="1.2" strokeLinecap={lc} fill="none"/>
        <path d="M7.5 19.5l2-2.5h5l2 2.5" stroke={c} strokeWidth="1.2" strokeLinecap={lc} fill="none"/>
      </>;
      break;
    case type === 54: // Tennis
      icon = <>
        <circle cx="10" cy="10" r="7.5" {...p}/>
        <line x1="15.5" y1="15.5" x2="20" y2="20" stroke={c} strokeWidth="2.8" strokeLinecap="round"/>
        <path d="M10 2.5c0 4-3.5 7 0 7.5" stroke={c} strokeWidth="1.1" fill="none"/>
        <path d="M10 2.5c0 4 3.5 7 0 7.5" stroke={c} strokeWidth="1.1" fill="none"/>
        <path d="M2.5 10c4 0 7 3.5 7.5 0" stroke={c} strokeWidth="1.1" fill="none"/>
        <path d="M2.5 10c4 0 7-3.5 7.5 0" stroke={c} strokeWidth="1.1" fill="none"/>
      </>;
      break;
    case type === 104: // Boxing
      icon = <>
        <path d="M8 18c-1.5-.5-3-2-3-5V9c0-2.5 1.5-4 4-4h6c2 0 3.5 1.5 3.5 4v4c0 3-1.5 4.5-3.5 5z"
          fill={c} opacity="0.2" stroke={c} strokeWidth="1.4" strokeLinejoin={lj}/>
        <path d="M8 10h3V7" stroke={c} strokeWidth="1.4" strokeLinecap={lc}/>
        <path d="M11 10v4" stroke={c} strokeWidth="1.4" strokeLinecap={lc}/>
        <path d="M11 10h3c1.5 0 3 1 3 2.5V15" stroke={c} strokeWidth="1.4" strokeLinecap={lc}/>
      </>;
      break;
    case type === 83: // Dance
      icon = <>
        <circle cx="14" cy="4" r="1.8" fill={c}/>
        <path d="M13 6l-2 5 3 3-1.5 5" {...p}/>
        <path d="M11 11L7 12.5" {...p}/>
        <path d="M14 8.5l4.5-.5" {...p}/>
        <path d="M14.5 14l2.5 3.5" {...p}/>
      </>;
      break;
    default: // Star / general
      icon = <path d="M12 2l2.5 7.5H22l-6.5 4.7 2.5 7.5L12 17.3 6 21.7l2.5-7.5L2 9.5h7.5z"
        fill={c} opacity="0.25" stroke={c} strokeWidth="1.4" strokeLinejoin={lj}/>;
  }

  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">{icon}</svg>;
}
