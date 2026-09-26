#!/usr/bin/env node
/**
 * Restaure une sauvegarde produite par /api/cron/backup dans Firestore.
 *
 * Usage :
 *   npx tsx scripts/restore-backup.ts <fichier.json | fichier.json.gz>                  # APERCU (rien n'est ecrit)
 *   npx tsx scripts/restore-backup.ts <fichier.json | fichier.json.gz> --apply          # ecrit, sans ecraser l'existant
 *   npx tsx scripts/restore-backup.ts <fichier.json | fichier.json.gz> --apply --overwrite   # ecrase les documents existants
 *   Options : --only=measurements,foodLog   limite a certaines collections
 *
 * Par defaut un document deja present est CONSERVE (aucune perte possible).
 * Tester d'abord sur un projet Firestore de test : FIREBASE_ADMIN_* dans l'environnement.
 */

import * as fs from "fs";
import { gunzipSync } from "zlib";
import * as path from "path";
import * as dotenv from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { revive } from "../app/lib/backup-format";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
const overwrite = args.includes("--overwrite");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");

if (!file) { console.error("Fichier de sauvegarde manquant."); process.exit(1); }

const META = new Set(["schemaVersion", "exportedAt", "user", "profile", "counts"]);
const raw = fs.readFileSync(file);
const backup = JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8")) as Record<string, unknown>;
const user = (backup.user as string) ?? "owner";

if (getApps().length === 0) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!.trim(),
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!.trim(),
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n").trim(),
  }) });
}
const db = getFirestore();

async function main() {
  console.log(`${apply ? "RESTAURATION" : "APERCU (dry-run)"} · fichier ${file} · exporte le ${backup.exportedAt}`);
  console.log(`Mode : ${overwrite ? "ECRASE les documents existants" : "conserve les documents existants"}\n`);

  let created = 0, skipped = 0, replaced = 0;
  for (const [name, docs] of Object.entries(backup)) {
    if (META.has(name) || !Array.isArray(docs)) continue;
    if (only && !only.includes(name)) continue;
    let c = 0, s = 0, r = 0;
    for (const raw of docs as Record<string, unknown>[]) {
      const { id, ...data } = raw as { id: string } & Record<string, unknown>;
      const ref = db.doc(`users/${user}/${name}/${id}`);
      const exists = (await ref.get()).exists;
      if (exists && !overwrite) { s++; continue; }
      if (apply) await ref.set(revive(data) as Record<string, unknown>);
      exists ? r++ : c++;
    }
    console.log(`${name.padEnd(24)} a creer ${String(c).padStart(5)} · ignores ${String(s).padStart(5)} · remplaces ${String(r).padStart(5)}`);
    created += c; skipped += s; replaced += r;
  }
  console.log(`\nTotal : ${created} crees, ${skipped} ignores (deja presents), ${replaced} remplaces.`);
  if (!apply) console.log("Rien n'a ete ecrit. Relance avec --apply pour restaurer.");
}

main().catch((e) => { console.error(e); process.exit(1); });
