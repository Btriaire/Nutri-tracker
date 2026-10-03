#!/usr/bin/env node
/**
 * Complete le sodium et les graisses saturees MANQUANTS dans le journal alimentaire existant.
 * N'ecrase jamais une valeur deja connue ; marque les ajouts dans nutrition.estimated.
 *
 * Usage (variables FIREBASE_ADMIN_* et GROQ_API_KEY dans l'environnement) :
 *   npx tsx scripts/backfill-nutrition.ts                 # SIMULATION : rien n'est ecrit
 *   npx tsx scripts/backfill-nutrition.ts --llm           # simulation, avec estimation IA des aliments non reconnus
 *   npx tsx scripts/backfill-nutrition.ts --llm --apply   # ecrit (chaque jour modifie est archive dans _history)
 *
 * Ordre de preference : sel x 400 > table CIQUAL > estimation IA > ratio de famille (graisses saturees seulement).
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { installWriteGuard } from "../app/lib/write-guard";
import { enrichNutrition } from "../app/lib/nutrition-enrich";
import { calcTotals } from "../app/lib/nutrition";
import { GROQ_TEXT_MODEL } from "../app/lib/groq";
import { AI_SODIUM_SAT_RULES } from "../app/lib/ai-food";
import type { DayLog, FoodEntry, FoodNutrition } from "../app/lib/types";

const apply = process.argv.includes("--apply");
const useLlm = process.argv.includes("--llm");

if (getApps().length === 0) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!.trim(),
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!.trim(),
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n").trim(),
  }) });
}
installWriteGuard();          // chaque ref.update() archive l'ancienne version du jour dans users/owner/_history
const db = getFirestore();

// Repas "placeholder" sans contenu reel ("repas generique 600 kcal", "grand plateau proteine") : une estimation IA du
// sodium serait une pure invention, on les laisse sans sodium.
const isPlaceholder = (name: string) => /^(grand |petit )?(repas|plateau)\b|g[ée]n[ée]rique/i.test(name.trim());

const missing = (n: FoodNutrition) => n.sodiumMg == null || n.saturatedFatG == null;
const key = (e: FoodEntry) => e.name.trim().toLowerCase();

interface LlmItem { name: string; sodiumMgPer100g?: number; saturatedFatGPer100g?: number }

async function askLlm(items: { name: string; kcalPer100g: number; fatPer100g: number }[]): Promise<Map<string, LlmItem>> {
  const out = new Map<string, LlmItem>();
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { console.error("GROQ_API_KEY absente : etape IA ignoree."); return out; }
  const BATCH = 15;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    // Limite de debit Groq (tokens/minute) : on attend et on reessaie plutot que de perdre le lot.
    let res: Response | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL, reasoning_effort: "low", temperature: 0.1, max_tokens: 1800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `Tu es nutritionniste. Pour chaque aliment, donne le sodium et les graisses saturees pour 100 g, d'apres les tables de composition francaises (CIQUAL). Reponds UNIQUEMENT en JSON : {"items":[{"name":"...","sodiumMgPer100g":120,"saturatedFatGPer100g":2.5}]}. Reprends les noms EXACTEMENT comme fournis.\n${AI_SODIUM_SAT_RULES.replace('"sodiumMg"', '"sodiumMgPer100g"').replace('"saturatedFatG"', '"saturatedFatGPer100g"').replace('"fatG"', 'les lipides fournis')}` },
            { role: "user", content: JSON.stringify(batch) },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status !== 429) break;
      const wait = Number((await res.text()).match(/try again in ([\d.]+)s/i)?.[1] ?? 20);
      console.error(`Groq 429 : pause ${Math.ceil(wait) + 2} s (lot ${i / BATCH + 1}, essai ${attempt + 1})`);
      await sleep((Math.ceil(wait) + 2) * 1000);
    }
    if (!res || !res.ok) { console.error("Groq", res?.status, "- lot ignore"); continue; }
    await sleep(6000);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    try {
      const parsed = JSON.parse(data.choices[0].message.content) as { items?: LlmItem[] };
      for (const it of parsed.items ?? []) {
        const src = batch.find((b) => b.name === it.name);
        if (!src) continue;
        const sodium = typeof it.sodiumMgPer100g === "number" && it.sodiumMgPer100g >= 0 && it.sodiumMgPer100g <= 39_340 ? it.sodiumMgPer100g : undefined;
        const sat = typeof it.saturatedFatGPer100g === "number" && it.saturatedFatGPer100g >= 0 && it.saturatedFatGPer100g <= src.fatPer100g + 0.5 ? it.saturatedFatGPer100g : undefined;
        out.set(src.name, { name: src.name, sodiumMgPer100g: sodium, saturatedFatGPer100g: sat });
      }
    } catch (e) { console.error("Reponse IA illisible :", e); }
  }
  return out;
}

async function main() {
  console.log(apply ? "ECRITURE" : "SIMULATION (rien n'est ecrit)", useLlm ? "· avec estimation IA" : "· CIQUAL seul");
  const snap = await db.collection("users/owner/foodLog").get();
  const days = snap.docs.map((d) => ({ ref: d.ref, id: d.id, log: d.data() as DayLog }));

  // Copie de securite locale AVANT toute ecriture (en plus du backup quotidien du VPS et de users/owner/_history).
  if (apply) {
    const dir = path.join(os.homedir(), "Backups", "nutri-tracker");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `foodLog-avant-completion-sodium-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(file, JSON.stringify(Object.fromEntries(days.map((d) => [d.id, d.log])), null, 1));
    console.log(`Copie de securite : ${file} (${days.length} jours)`);
  }

  // 1) premiere passe : CIQUAL / sel / ratio ; on repere les aliments sans sodium qui restent
  const unresolved = new Map<string, { name: string; kcal: number; grams: number; fat: number }>();
  for (const { log } of days) for (const e of log.entries ?? []) {
    if (!missing(e.nutrition)) continue;
    const after = enrichNutrition(e.name, e.servingGrams, e.nutrition);
    if (after.sodiumMg == null && e.servingGrams > 0 && !isPlaceholder(e.name)) {
      const u = unresolved.get(key(e)) ?? { name: e.name.trim(), kcal: 0, grams: 0, fat: 0 };
      u.kcal += e.nutrition.calories; u.grams += e.servingGrams; u.fat += e.nutrition.fatG;
      unresolved.set(key(e), u);
    }
  }
  console.log(`Aliments distincts sans sodium apres CIQUAL : ${unresolved.size}`);

  // 2) estimation IA des non reconnus (optionnelle)
  let llm = new Map<string, LlmItem>();
  if (useLlm && unresolved.size) {
    llm = await askLlm([...unresolved.values()].map((u) => ({
      name: u.name,
      kcalPer100g: Math.round((u.kcal / u.grams) * 100),
      fatPer100g: Math.round((u.fat / u.grams) * 1000) / 10,
    })));
    console.log(`Estimations IA recues : ${llm.size}/${unresolved.size}`);
  }

  // 3) application jour par jour
  let entriesChanged = 0, daysChanged = 0;
  const sodiumBefore: number[] = [], sodiumAfter: number[] = [], satBefore: number[] = [], satAfter: number[] = [];
  const samples: string[] = [];
  // Controle : sodium estime pour 100 g, par aliment distinct et par origine, pour reperer les valeurs douteuses.
  const review = new Map<string, { per100: number; source: string; grams: number }>();
  const contrib = new Map<string, { sodium: number; sat: number; n: number }>();   // contributeurs sur 30 jours (apres correction)
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  for (const { ref, id, log } of days) {
    const entries = log.entries ?? [];
    let changed = false;
    const next = entries.map((e) => {
      if (!missing(e.nutrition)) return e;
      let n = enrichNutrition(e.name, e.servingGrams, e.nutrition);
      const ai = isPlaceholder(e.name) ? undefined : llm.get(e.name.trim());
      if (ai) {
        const r = e.servingGrams / 100;
        const est = new Set(n.estimated ?? []);
        if (n.sodiumMg == null && ai.sodiumMgPer100g != null) { n = { ...n, sodiumMg: Math.round(ai.sodiumMgPer100g * r), saltG: Math.round((ai.sodiumMgPer100g * r / 400) * 10) / 10 }; est.add("sodiumMg"); }
        if (e.nutrition.saturatedFatG == null && ai.saturatedFatGPer100g != null && n.estimated?.includes("saturatedFatG")) {
          n = { ...n, saturatedFatG: Math.round(Math.min(e.nutrition.fatG, ai.saturatedFatGPer100g * r) * 10) / 10 }; est.add("saturatedFatG");
        }
        if (est.size) n = { ...n, estimated: [...est] };
      }
      if (n === e.nutrition) return e;
      if (e.nutrition.sodiumMg == null && n.sodiumMg != null && e.servingGrams > 0) {
        review.set(key(e), { per100: Math.round((n.sodiumMg / e.servingGrams) * 100), source: ai?.sodiumMgPer100g != null && n.estimated?.includes("sodiumMg") && !enrichNutrition(e.name, e.servingGrams, e.nutrition).sodiumMg ? "IA" : "CIQUAL/sel", grams: e.servingGrams });
      }
      changed = true; entriesChanged++;
      if (samples.length < 14 && Math.random() < 0.04) samples.push(`${e.name} (${e.servingGrams} g) -> Na ${n.sodiumMg ?? "?"} mg, sat ${n.saturatedFatG ?? "?"} g`);
      return { ...e, nutrition: n };
    });
    const before = calcTotals(entries), after = calcTotals(next);
    if (id >= since) for (const e of next) {
      const c = contrib.get(key(e)) ?? { sodium: 0, sat: 0, n: 0 };
      c.sodium += e.nutrition.sodiumMg ?? 0; c.sat += e.nutrition.saturatedFatG ?? 0; c.n++;
      contrib.set(key(e), c);
    }
    if (id >= new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)) {
      sodiumBefore.push(before.sodiumMg ?? 0); sodiumAfter.push(after.sodiumMg ?? 0);
      satBefore.push(before.saturatedFatG ?? 0); satAfter.push(after.saturatedFatG ?? 0);
    }
    if (!changed) continue;
    daysChanged++;
    if (apply) await ref.update({ entries: next, totals: after, updatedAt: Timestamp.now() });
  }

  const avg = (a: number[]) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : 0;
  console.log(`\nEntrees completees : ${entriesChanged} · jours modifies : ${daysChanged}`);
  console.log(`Moyenne 30 derniers jours — sodium : ${avg(sodiumBefore)} -> ${avg(sodiumAfter)} mg/j · graisses saturees : ${avg(satBefore)} -> ${avg(satAfter)} g/j`);
  console.log("Exemples :\n  " + samples.join("\n  "));
  const top = (f: (c: { sodium: number; sat: number }) => number) => [...contrib.entries()].sort((a, b) => f(b[1]) - f(a[1])).slice(0, 12);
  console.log("\nPrincipaux contributeurs sur 30 jours :");
  console.log("  sodium :", top((c) => c.sodium).map(([k, c]) => `${k} ${Math.round(c.sodium)} mg (x${c.n})`).join(" | "));
  console.log("  gr. sat. :", top((c) => c.sat).map(([k, c]) => `${k} ${Math.round(c.sat * 10) / 10} g (x${c.n})`).join(" | "));
  console.log("\nSodium estime le plus eleve (mg / 100 g) — a verifier :");
  for (const [name, r] of [...review.entries()].sort((a, b) => b[1].per100 - a[1].per100).slice(0, 30)) console.log(`  ${String(r.per100).padStart(5)}  ${r.source.padEnd(10)} ${name}`);
  if (!apply) console.log("\nRien n'a ete ecrit. Relance avec --apply pour appliquer.");
}

main().catch((e) => { console.error(e); process.exit(1); });
