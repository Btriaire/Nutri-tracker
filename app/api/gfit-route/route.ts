import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getTokens } from "@/app/lib/google-fit";
import type { GpsPoint } from "@/app/lib/types";

const GPS_SOURCE = "derived:com.google.location.sample:com.google.android.gms:merge_location_samples";

/**
 * GET /api/gfit-route?startMs=...&endMs=...
 * Returns { points: GpsPoint[] } — up to 250 down-sampled GPS points.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startMs = Number(searchParams.get("startMs"));
  const endMs   = Number(searchParams.get("endMs"));

  if (!startMs || !endMs || endMs <= startMs) {
    return NextResponse.json({ error: "Invalid startMs / endMs" }, { status: 400 });
  }

  const tokens = await getTokens(session.userId);
  if (!tokens) {
    return NextResponse.json({ error: "Google Fit not connected" }, { status: 403 });
  }

  const startNs = String(startMs * 1_000_000);
  const endNs   = String(endMs   * 1_000_000);

  const url = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(GPS_SOURCE)}/datasets/${startNs}-${endNs}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("GPS route fetch error:", res.status, text);
      return NextResponse.json({ points: [] });
    }

    type RawPoint = {
      startTimeNanos?: string;
      value?: { fpVal?: number }[];
    };
    const json = await res.json() as { point?: RawPoint[] };
    const raw  = json.point ?? [];

    if (raw.length === 0) return NextResponse.json({ points: [] });

    // Parse all points
    const all: GpsPoint[] = raw
      .map((p) => ({
        lat:  p.value?.[0]?.fpVal ?? 0,
        lng:  p.value?.[1]?.fpVal ?? 0,
        alt:  p.value?.[2]?.fpVal ?? null,
        tsMs: Math.round(Number(p.startTimeNanos ?? 0) / 1_000_000),
      }))
      .filter((p) => p.lat !== 0 && p.lng !== 0);

    // Down-sample to at most 250 points (evenly spaced)
    const MAX_POINTS = 250;
    let points: GpsPoint[];
    if (all.length <= MAX_POINTS) {
      points = all;
    } else {
      const step = (all.length - 1) / (MAX_POINTS - 1);
      points = Array.from({ length: MAX_POINTS }, (_, i) => all[Math.round(i * step)]);
    }

    return NextResponse.json({ points });
  } catch (err) {
    console.error("GPS route error:", err);
    return NextResponse.json({ points: [] });
  }
}
