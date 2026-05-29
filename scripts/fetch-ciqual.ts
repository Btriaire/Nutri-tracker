#!/usr/bin/env node
/**
 * Download Ciqual 2020 data from Zenodo (XLS) and convert to ciqual.json
 * Run: npx tsx scripts/fetch-ciqual.ts
 */

import * as XLSX from "xlsx";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import * as path from "path";

const ZENODO_URL =
  "https://zenodo.org/records/4770600/files/Table%20Ciqual%202020_FR_2020%2007%2007.xls?download=1";

const OUT_JSON = path.join(__dirname, "ciqual.json");
const TMP_XLS  = path.join(__dirname, "ciqual_tmp.xls");

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u: string) => {
      const proto = u.startsWith("https") ? https : http;
      proto.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (!location) { reject(new Error("Redirect without location")); return; }
          console.log(`↪  Redirect → ${location.substring(0, 80)}…`);
          get(location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const total = parseInt(res.headers["content-length"] ?? "0", 10);
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (total) {
            const pct = Math.round((received / total) * 100);
            process.stdout.write(`\r  Downloaded ${pct}% (${(received / 1024).toFixed(0)} KB)`);
          }
        });
        res.pipe(file);
        file.on("finish", () => { file.close(); console.log(""); resolve(); });
        file.on("error", reject);
        res.on("error", reject);
      }).on("error", reject);
    };
    get(url);
  });
}

async function main() {
  console.log("📥  Downloading Ciqual 2020 XLS from Zenodo…");
  await downloadFile(ZENODO_URL, TMP_XLS);
  console.log("✅  Download complete");

  console.log("📊  Parsing XLS…");
  const workbook = XLSX.readFile(TMP_XLS, { type: "file", cellDates: false });

  // Find the main data sheet (usually the first or the one with food data)
  const sheetName = workbook.SheetNames[0];
  console.log(`   Sheet: "${sheetName}"`);
  const sheet = workbook.Sheets[sheetName];

  const rows: Record<string, string | number | undefined>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: undefined,
    raw: false,   // keep as strings for comma-decimal handling
  });

  console.log(`   Rows found: ${rows.length}`);
  if (rows.length === 0) {
    console.error("❌  No data rows found");
    process.exit(1);
  }

  // Show first row keys
  const firstRow = rows[0];
  console.log("\n   Column names (first 10):");
  Object.keys(firstRow).slice(0, 10).forEach((k) => console.log(`     "${k}"`));

  // Detect the code and name columns — Ciqual uses French column headers
  // alim_code and alim_nom_fr may be exact or slightly different
  const keys = Object.keys(firstRow);

  function findKey(candidates: string[]): string | undefined {
    for (const c of candidates) {
      if (keys.find((k) => k === c || k.toLowerCase().includes(c.toLowerCase()))) {
        return keys.find((k) => k === c || k.toLowerCase().includes(c.toLowerCase()));
      }
    }
    return undefined;
  }

  const codeKey = findKey(["alim_code", "code", "Code"]) ?? keys[0];
  const nameKey = findKey(["alim_nom_fr", "nom_fr", "Nom fr", "alim_nom", "aliment"]) ?? keys[1];
  const grpKey  = findKey(["alim_grp_nom_fr", "grp_nom_fr", "sous-groupe", "groupe"]);

  console.log(`\n   Code column:  "${codeKey}"`);
  console.log(`   Name column:  "${nameKey}"`);
  console.log(`   Group column: "${grpKey ?? "not found"}"`);

  // Remap to expected RawCiqualFlat structure
  const output = rows.map((row) => {
    const mapped: Record<string, string | number | undefined> = {};
    // Standard keys
    mapped["alim_code"]     = row[codeKey];
    mapped["alim_nom_fr"]   = row[nameKey];
    if (grpKey) mapped["alim_grp_nom_fr"] = row[grpKey];
    // Copy all other columns as-is (nutrient columns keep their French names)
    for (const [k, v] of Object.entries(row)) {
      if (k !== codeKey && k !== nameKey && (!grpKey || k !== grpKey)) {
        mapped[k] = v;
      }
    }
    return mapped;
  });

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n✅  Written ${output.length} rows → ${OUT_JSON}`);

  // Clean up temp file
  fs.unlinkSync(TMP_XLS);
  console.log("🗑   Removed temp XLS file");
  console.log("\n👉  Now run: npx tsx scripts/import-ciqual.ts");
}

main().catch((err) => {
  console.error("❌ ", err);
  process.exit(1);
});
