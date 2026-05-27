"use client";

import { useEffect, useRef } from "react";

export default function WelcomeChime() {
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;

    // Play only if user has interacted with the page before (autoplay policy)
    const play = () => {
      try {
        const ctx = new AudioContext();

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

          // Bell-like envelope: fast attack, slow decay
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);

          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration + 0.05);
        });

        setTimeout(() => ctx.close(), 1500);
      } catch { /* AudioContext not available */ }
    };

    // Small delay so page paint happens first
    const timer = setTimeout(play, 300);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
