import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { isConnected, syncGlucoseDay } from "@/app/lib/google-fit";
import { format, subDays, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * POST /api/glucose/sync { date } — recupere seulement la glycemie de Google Fit pour ce jour. Pour aujourd'hui, la veille est
 * resynchronisee aussi : les lectures entre minuit et 02:00 (heure de Paris) sont rangees dans le document de la veille.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await req.json().catch(() => ({})) as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  if (!(await isConnected(session.userId))) return NextResponse.json({ ok: false, error: "Not connected" }, { status: 400 });

  const dates = [date];
  const today = format(new Date(), "yyyy-MM-dd");
  if (date >= format(subDays(parseISO(today), 1), "yyyy-MM-dd")) dates.unshift(format(subDays(parseISO(date), 1), "yyyy-MM-dd"));

  const results = await Promise.all(dates.map((d) => syncGlucoseDay(session.userId, d)));
  return NextResponse.json({ ok: results.every((r) => r.ok), readings: results.map((r) => r.readings) });
}
