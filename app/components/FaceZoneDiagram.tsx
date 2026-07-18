"use client";

import type { FaceScanScorecard } from "@/app/lib/types";

interface Props {
  scorecard: FaceScanScorecard;
  size?: number;
}

/** Maps a 1-5 score to an overlay opacity — low score barely visible, high score clearly tinted. */
function scoreOpacity(score: number, max = 0.55): number {
  return 0.08 + (Math.min(5, Math.max(1, score)) - 1) * (max - 0.08) / 4;
}

/**
 * Stylized, generic face diagram (not the user's actual photo) with
 * color-coded zones whose opacity reflects the scan's scorecard —
 * a quick visual read of which areas are most notable this scan.
 */
export default function FaceZoneDiagram({ scorecard, size = 180 }: Props) {
  const gaunt  = scoreOpacity(scorecard.amaigrissement); // indigo — temples/cheeks/jaw
  const tired  = scoreOpacity(scorecard.fatigue);        // amber — under-eyes
  const tone   = scoreOpacity(scorecard.teint, 0.35);    // rose — overall face tint

  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">
      {/* Overall face tone tint */}
      <ellipse cx="100" cy="120" rx="68" ry="93" fill="#f43f5e" opacity={tone} />

      {/* Base face outline */}
      <ellipse cx="100" cy="120" rx="68" ry="93" fill="none" stroke="var(--text-muted)" strokeWidth="2" opacity="0.5" />

      {/* Temples (amaigrissement) */}
      <ellipse cx="45" cy="88" rx="16" ry="26" fill="#6366f1" opacity={gaunt} />
      <ellipse cx="155" cy="88" rx="16" ry="26" fill="#6366f1" opacity={gaunt} />

      {/* Cheeks (amaigrissement) */}
      <circle cx="48" cy="138" r="24" fill="#6366f1" opacity={gaunt} />
      <circle cx="152" cy="138" r="24" fill="#6366f1" opacity={gaunt} />

      {/* Jawline (amaigrissement) */}
      <path d="M 40 175 Q 60 205 100 212 Q 140 205 160 175"
        fill="none" stroke="#6366f1" strokeWidth="10" strokeLinecap="round" opacity={gaunt * 0.8} />

      {/* Eyes */}
      <circle cx="70" cy="103" r="5" fill="var(--text-secondary)" opacity="0.7" />
      <circle cx="130" cy="103" r="5" fill="var(--text-secondary)" opacity="0.7" />

      {/* Under-eyes (fatigue) */}
      <ellipse cx="70" cy="117" rx="17" ry="8" fill="#f59e0b" opacity={tired} />
      <ellipse cx="130" cy="117" rx="17" ry="8" fill="#f59e0b" opacity={tired} />

      {/* Nose */}
      <path d="M 100 108 L 100 138 Q 100 144 94 145" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.4" />

      {/* Mouth */}
      <path d="M 78 168 Q 100 176 122 168" fill="none" stroke="var(--text-muted)" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
    </svg>
  );
}
