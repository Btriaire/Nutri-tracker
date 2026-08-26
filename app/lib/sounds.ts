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

/** A subtle two-tone "tap" for switching between the main app sections. */
export function playNavSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const run = () => {
    const osc    = ctx.createOscillator();
    const gain   = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 1800;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.16);
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(run).catch(() => {});
  } else {
    run();
  }
}
