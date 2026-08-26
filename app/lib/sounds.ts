// Soft, generated UI sounds (WebAudio — no audio files) — same technique as
// WelcomeChime.tsx, but much shorter/quieter since this plays on every tab
// switch instead of once per session.

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new AudioContext();
    return sharedCtx;
  } catch {
    return null;
  }
}

/** A soft, warm "pluck" for switching between the main app sections — a
 * fundamental note plus a quiet octave overtone (like a mellow kalimba/bell)
 * instead of a pitch-swept blip, with a slow attack and a natural decay. */
export function playNavSound() {
  const ctx = getCtx();
  if (!ctx) return;

  const pluck = (freq: number, gainPeak: number, start: number, duration: number) => {
    const osc    = ctx.createOscillator();
    const gain   = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 1400;
    filter.Q.value = 0.3;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

    gain.gain.setValueAtTime(0, ctx.currentTime + start);
    gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);

    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.05);
  };

  const run = () => {
    // Fundamental (E5) + a quiet octave-up shimmer, both fading naturally —
    // reads as one warm "note" rather than an electronic chirp.
    pluck(659.25, 0.045, 0,     0.24);
    pluck(1318.5, 0.014, 0.01,  0.18);
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(run).catch(() => {});
  } else {
    run();
  }
}
