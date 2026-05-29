import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";

const USER = "owner";

// ─── Helper: fetch entire subcollection ───────────────────────────────────────

async function fetchCollection(db: FirebaseFirestore.Firestore, path: string) {
  const snap = await db.collection(path).get();
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ─── Helper: fetch subcollection with date range ──────────────────────────────

async function fetchDateRange(
  db: FirebaseFirestore.Firestore,
  path: string,
  field: string,
  from?: string,
  to?: string,
) {
  let q: FirebaseFirestore.Query = db.collection(path);
  if (from) q = q.where(field, ">=", from);
  if (to)   q = q.where(field, "<=", to);
  const snap = await q.get();
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ─── Sanitize timestamps → ISO strings ───────────────────────────────────────

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  // Firestore Timestamp
  if (
    typeof (obj as Record<string, unknown>)._seconds === "number" &&
    typeof (obj as Record<string, unknown>)._nanoseconds === "number"
  ) {
    const ts = obj as { _seconds: number; _nanoseconds: number };
    return new Date(ts._seconds * 1000 + ts._nanoseconds / 1e6).toISOString();
  }

  if (Array.isArray(obj)) return obj.map(sanitize);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = sanitize(v);
  }
  return result;
}

// ─── GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv ───────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from   = searchParams.get("from")   ?? undefined;
  const to     = searchParams.get("to")     ?? undefined;
  const format = searchParams.get("format") ?? "json";

  const db = getAdminFirestore();
  const base = `users/${USER}`;

  // ── Fetch everything in parallel ──────────────────────────────────────────
  const [
    profileSnap,
    foodLogDocs,
    healthDocs,
    fitnessDocs,
    manualActivities,
    customFoods,
    recipeDocs,
    savedMealDocs,
    mentalHealthDocs,
    workoutTemplates,
  ] = await Promise.all([
    db.doc(`${base}`).get(),
    fetchDateRange(db, `${base}/foodLog`,          "_id",  from, to),
    fetchDateRange(db, `${base}/healthEntries`,    "date", from, to),
    fetchDateRange(db, `${base}/fitnessData`,      "_id",  from, to),
    fetchCollection(db, `${base}/manualActivities`),
    fetchCollection(db, `${base}/customFoods`),
    fetchCollection(db, `${base}/recipes`),
    fetchCollection(db, `${base}/savedMeals`),
    fetchCollection(db, `${base}/mentalHealth`),
    fetchCollection(db, `${base}/workoutTemplates`),
  ]);

  const profile = profileSnap.exists ? profileSnap.data() : null;

  // ── Build export object ───────────────────────────────────────────────────

  const exportDate = new Date().toISOString();

  const payload = {
    meta: {
      exportedAt:  exportDate,
      exportedBy:  USER,
      appVersion:  "nutri-tracker",
      dateRange:   { from: from ?? "all", to: to ?? "all" },
      totalDays:   foodLogDocs.length,
    },

    profile: sanitize(profile),

    foodLog: (sanitize(foodLogDocs) as Record<string,string>[])
      .sort((a, b) => (a._id ?? "").localeCompare(b._id ?? "")),

    healthEntries: (sanitize(healthDocs) as Record<string,string>[])
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),

    fitnessData: (sanitize(fitnessDocs) as Record<string,string>[])
      .sort((a, b) => (a._id ?? "").localeCompare(b._id ?? "")),

    manualActivities: sanitize(manualActivities),
    customFoods:      sanitize(customFoods),
    recipes:          sanitize(recipeDocs),
    savedMeals:       sanitize(savedMealDocs),
    mentalHealth:     sanitize(mentalHealthDocs),
    workoutTemplates: sanitize(workoutTemplates),
  };

  // ── JSON export ───────────────────────────────────────────────────────────

  if (format === "json") {
    const filename = `nutri-tracker-export-${exportDate.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type":        "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── CSV export (food log only — most useful for spreadsheets) ────────────

  if (format === "csv") {
    const rows: string[] = [];

    // Header
    rows.push([
      "date", "meal", "food_name", "brand", "source",
      "grams", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g",
      "sugar_g", "saturated_fat_g", "sodium_mg", "water_g",
    ].join(","));

    for (const day of payload.foodLog as Record<string, unknown>[]) {
      const date = day._id as string;
      const meals = day.meals as Record<string, unknown[]> | undefined;
      if (!meals) continue;
      for (const [mealType, entries] of Object.entries(meals)) {
        if (!Array.isArray(entries)) continue;
        for (const e of entries) {
          const entry = e as Record<string, unknown>;
          const n = (entry.nutrition as Record<string, unknown>) ?? {};
          const row = [
            date,
            mealType,
            csvEscape(String(entry.name ?? "")),
            csvEscape(String(entry.brand ?? "")),
            csvEscape(String(entry.source ?? "")),
            entry.grams ?? 0,
            n.calories  ?? 0,
            n.proteinG  ?? 0,
            n.carbsG    ?? 0,
            n.fatG      ?? 0,
            n.fiberG    ?? 0,
            n.sugarG    ?? "",
            n.saturatedFatG ?? "",
            n.sodiumMg  ?? "",
            n.waterG    ?? "",
          ].join(",");
          rows.push(row);
        }
      }
    }

    const csv = rows.join("\n");
    const filename = `nutri-tracker-foodlog-${exportDate.slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown format" }, { status: 400 });
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
