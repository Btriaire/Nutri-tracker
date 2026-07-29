export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { buildReportData } from "@/app/lib/report-builder";
import ReportDocument from "../ReportDocument";

const USER_ID = "owner";

// Token-authenticated, unstyled-chrome render of the report, used only by the
// server-side PDF pipeline (puppeteer navigates here instead of /report).
export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; token?: string }>;
}) {
  const { from, to, token } = await searchParams;

  const secret = process.env.REPORT_CRON_SECRET;
  if (!secret || !token || token !== secret) notFound();
  if (!from || !to) notFound();

  const data = await buildReportData(USER_ID, from, to);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { background: #ffffff !important; color: #1a1a2e !important; height: auto !important; min-height: 0 !important; }
        nav, .bg-orbs { display: none !important; }
        @page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; background: #ffffff; }
        .glass, .glass-strong { background: #f8f9fc !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; }
        :root { --text-primary: #0f172a !important; --text-secondary: #334155 !important; --text-muted: #64748b !important; --border: #e2e8f0 !important; }
        .report-cover { page-break-after: always; }
        .report-page-break { page-break-before: always; }
        .report-card { break-inside: avoid !important; }
      ` }} />
      <div className="max-w-2xl mx-auto px-4 py-6" style={{ background: "#ffffff", minHeight: "100%" }}>
        <ReportDocument data={data} />
      </div>
    </>
  );
}
