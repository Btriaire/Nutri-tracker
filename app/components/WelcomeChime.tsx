"use client";

import { useEffect, useRef } from "react";

export default function WelcomeChime() {
  const played = useRef(false);

  useEffect(() => {
    const play = async () => {
      if (played.current) return;
      played.current = true;

      try {
        const ctx = new AudioContext();
        // Resume in case the context is suspended (autoplay policy)
        if (ctx.state === "suspended") await ctx.resume();

        // A gentle two-note chime: C5 → E5
        const notes = [
          { freq: 523.25, start: 0,    duration: 0.5 },
          { freq: 659.25, start: 0.18, duration: 0.6 },
        ];

        notes.forEach(({ freq, start, duration }) => {
          const osc    = ctx.createOscillator();
          const gain   = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          filter.type = "lowpass";
          filter.frequency.value = 2200;

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);

          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration + 0.05);
        });

        setTimeout(() => ctx.close(), 1500);
      } catch { /* AudioContext not available */ }
    };

    // Try immediately (works after navigation from another page — context already unlocked)
    const timer = setTimeout(play, 300);

    // Fallback: play on first user interaction (handles fresh page loads on iOS/Chrome)
    document.addEventListener("click",      play, { once: true });
    document.addEventListener("touchstart", play, { once: true });

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click",      play);
      document.removeEventListener("touchstart", play);
    };
  }, []);

  return null;
}
