export const dynamic = "force-dynamic";

import ImportMeditationClient from "./ImportMeditationClient";

// Landing page for the "Exporter vers NutriTracker" link from Halcyon-PaLaMa
// (a separate app, different origin — it can't call /api/meditation
// directly since its fetch wouldn't carry this app's session cookie
// cross-site). Instead it opens this page as a normal top-level
// navigation, which DOES carry the cookie, then the confirm button below
// does an ordinary same-origin fetch that works exactly like the existing
// in-app meditation logging.
export default async function ImportMeditationPage({
  searchParams,
}: {
  searchParams: Promise<{ programId?: string; programLabel?: string; durationMin?: string }>;
}) {
  const { programId, programLabel, durationMin } = await searchParams;

  const durationMinNum = durationMin ? Number(durationMin) : NaN;
  const valid =
    !!programId && !!programLabel && Number.isFinite(durationMinNum) && durationMinNum > 0;

  return (
    <ImportMeditationClient
      valid={valid}
      programId={programId ?? ""}
      programLabel={programLabel ?? ""}
      durationMin={valid ? Math.round(durationMinNum) : 0}
    />
  );
}
