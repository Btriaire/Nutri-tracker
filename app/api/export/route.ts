import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const USER = "owner";
const SCHEMA_VERSION = 2;

// Exclues : jetons de connexion, photos base64 (sauvegardees a part par le cron), historique interne.
const EXCLUDED = new Set(["oauthTokens", "dayPhotos", "mealPhotos", "faceScans", "_history"]);
const DATE_ID = /^\d{4}-\d{2}-\d{2}$/;

// ─── Timestamps → ISO ────────────────────────────────────────────────────────

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  const o = obj as Record<string, unknown>;
  if (typeof o.toDate === "function") return (o.toDate as () => Date)().toISOString();
  if (Array.isArray(obj)) return obj.map(sanitize);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (/token|secret|password/i.test(k)) continue;
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
  const userRef = db.doc(`users/${USER}`);

  // Toutes les sous-collections sont decouvertes dynamiquement : rien n'est oublie.
  const names = (await userRef.listCollections()).map((c) => c.id).filter((n) => !EXCLUDED.has(n));
  const [profileSnap, ...snaps] = await Promise.all([
    userRef.get(),
    ...names.map((n) => db.collection(`users/${USER}/${n}`).get()),
  ]);

  // La plage de dates ne s'applique qu'aux documents dont l'id est une date (journaux quotidiens).
  const inRange = (id: string) => !DATE_ID.test(id) || ((!from || id >= from) && (!to || id <= to));

  const collections: Record<string, unknown[]> = {};
  names.forEach((n, i) => {
    collections[n] = snaps[i].docs
      .filter((d) => inRange(d.id))
      .map((d) => ({ _id: d.id, ...(sanitize(d.data()) as Record<string, unknown>) }))
      .sort((a, b) => String(a._id).localeCompare(String(b._id)));
  });

  const exportDate = new Date().toISOString();
  const counts = Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length]));

  if (format === "json") {
    const payload = {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: exportDate,
        exportedBy: USER,
        dateRange: { from: from ?? "all", to: to ?? "all" },
        units: { energy: "kcal", macros: "g", sodium: "mg", water: "ml", weight: "kg", length: "cm" },
        counts,
        notIncluded: ["photos (dayPhotos, mealPhotos, faceScans)", "jetons de connexion"],
      },
      profile: sanitize(profileSnap.exists ? profileSnap.data() : null),
      ...collections,
    };
    const filename = `nutri-tracker-export-${exportDate.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type":        "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── CSV : journal alimentaire, 1 ligne par aliment, ouvrable dans Excel FR ──
  if (format === "csv") {
    const SEP = ";";
    const num = (v: unknown) => (v == null || v === "" ? "" : String(v).replace(".", ","));
    const rows: string[] = [[
      "date", "repas", "aliment", "marque", "source", "portion", "grammes", "calories",
      "proteines_g", "glucides_g", "lipides_g", "fibres_g", "sucres_g", "graisses_saturees_g", "sodium_mg",
    ].join(SEP)];

    for (const day of (collections.foodLog ?? []) as Record<string, unknown>[]) {
      const entries = Array.isArray(day.entries) ? (day.entries as Record<string, unknown>[]) : [];
      for (const e of entries) {
        const n = (e.nutrition as Record<string, unknown>) ?? {};
        rows.push([
          day._id,
          e.meal ?? "",
          csvEscape(String(e.name ?? "")),
          csvEscape(String(e.brand ?? "")),
          csvEscape(String(e.source ?? "")),
          csvEscape(String(e.servingLabel ?? "")),
          num(e.servingGrams),
          num(n.calories), num(n.proteinG), num(n.carbsG), num(n.fatG), num(n.fiberG),
          num(n.sugarG), num(n.saturatedFatG), num(n.sodiumMg),
        ].join(SEP));
      }
    }

    // BOM UTF-8 : sans lui Excel casse les accents.
    const csv = "﻿" + rows.join("\r\n");
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
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
