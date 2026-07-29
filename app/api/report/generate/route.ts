export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";

const USER_ID = "owner";

function getBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function computeRange(period: "7d" | "30d") {
  const to   = format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(new Date(), period === "7d" ? 6 : 29), "yyyy-MM-dd");
  return { from, to };
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  const secret = process.env.REPORT_CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;

  const session = await getSession();
  return !!session;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") === "30d" ? "30d" : "7d") as "7d" | "30d";
  const { from, to } = computeRange(period);

  const secret = process.env.REPORT_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "REPORT_CRON_SECRET is not configured" }, { status: 500 });
  }

  const baseUrl  = getBaseUrl();
  const printUrl = `${baseUrl}/report/print?from=${from}&to=${to}&token=${secret}`;

  const CHROMIUM_PACK_URL = "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

  let pdfBuffer: Buffer;
  try {
    const chromium   = (await import("@sparticuz/chromium-min")).default;
    const puppeteer   = await import("puppeteer-core");

    const browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: "shell",
    });
    try {
      const page = await browser.newPage();
      await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 45000 });
      const uint8 = await page.pdf({ format: "A4", printBackground: true });
      pdfBuffer = Buffer.from(uint8);
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.error("[report/generate] PDF render failed", e);
    const message = e instanceof Error ? e.message : String(e);
    const stack   = e instanceof Error ? e.stack : undefined;
    try {
      await getAdminFirestore().doc("debug/report-generate-last-error").set({
        message, stack: stack ?? null, at: new Date().toISOString(),
      });
    } catch {}
    return NextResponse.json({ error: "PDF render failed", message }, { status: 500 });
  }

  try {
    // ── Upload to Vercel Blob ───────────────────────────────────────────────
    const fileName = `${period}-${to}.pdf`;
    const storagePath = `reports/${USER_ID}/${fileName}`;
    const blob = await put(storagePath, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
    const publicUrl = blob.url;

    // ── Save history entry ──────────────────────────────────────────────────
    const db = getAdminFirestore();
    const id = db.collection(`users/${USER_ID}/reports`).doc().id;
    await db.doc(`users/${USER_ID}/reports/${id}`).set({
      id,
      period,
      from,
      to,
      generatedAt: new Date().toISOString(),
      url: publicUrl,
      sizeKb: Math.round(pdfBuffer.byteLength / 1024),
    });

    return NextResponse.json({ ok: true, id, url: publicUrl, period, from, to });
  } catch (e) {
    console.error("[report/generate] Storage upload failed", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Storage upload failed", message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
