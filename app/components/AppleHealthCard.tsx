"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Copy, Check, ArrowsClockwise, Warning, Spinner, UploadSimple } from "@phosphor-icons/react";

interface Props {
  connected?:    boolean;
  lastSyncedAt?: string | null;
}

interface DayRecord {
  date:             string;
  steps:            number;
  activeCalories:   number;
  activeMinutes:    number;
  heartRateAvg:     number | null;
  heartRateResting: number | null;
  hrv:              number | null;
  spO2:             number | null;
  sleepMinutes:     number | null;
  sleepDeepMinutes: number | null;
  sleepRemMinutes:  number | null;
  distanceKm:       number | null;
  vo2Max:           number | null;
  weightKg:         number | null;
  workouts:         { type: string; durationMin: number; calories: number }[];
}

// ─── XML parser (client-side, streaming-friendly) ───────────────────────────

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return m ? m[1] : "";
}

function parseDate(d: string): string {
  // "2024-01-15 08:30:00 +0200" → "2024-01-15"
  return d.slice(0, 10);
}

function parseDurationMin(start: string, end: string): number {
  const ms = new Date(end.replace(" ", "T").replace(/ [+-]\d{4}$/, "Z")).getTime()
           - new Date(start.replace(" ", "T").replace(/ [+-]\d{4}$/, "Z")).getTime();
  return Math.round(ms / 60000);
}

function parseXML(xml: string): DayRecord[] {
  const acc: Record<string, {
    steps: number; activeCalories: number; activeMinutes: number;
    hrSum: number; hrCount: number;
    hrRestSum: number; hrRestCount: number;
    hrvSum: number; hrvCount: number;
    spO2Sum: number; spO2Count: number;
    sleepMin: number; deepMin: number; remMin: number;
    distKm: number;
    vo2MaxLast: number | null;
    weightLast: number | null;
    workouts: { type: string; durationMin: number; calories: number }[];
  }> = {};

  const ensure = (d: string) => {
    if (!acc[d]) acc[d] = {
      steps: 0, activeCalories: 0, activeMinutes: 0,
      hrSum: 0, hrCount: 0, hrRestSum: 0, hrRestCount: 0,
      hrvSum: 0, hrvCount: 0, spO2Sum: 0, spO2Count: 0,
      sleepMin: 0, deepMin: 0, remMin: 0,
      distKm: 0, vo2MaxLast: null, weightLast: null,
      workouts: [],
    };
    return acc[d];
  };

  // Match all self-closing <Record .../> tags
  const recRe = /<Record\s([^>]+?)(?:\s*\/>|>(?:[\s\S]*?)<\/Record>)/g;
  let m: RegExpExecArray | null;

  while ((m = recRe.exec(xml)) !== null) {
    const tag  = m[1];
    const type = attr(tag, "type");
    const val  = parseFloat(attr(tag, "value"));
    const sd   = attr(tag, "startDate");
    const ed   = attr(tag, "endDate");
    if (!sd) continue;
    const date = parseDate(sd);
    const a    = ensure(date);

    switch (type) {
      case "HKQuantityTypeIdentifierStepCount":             a.steps          += isNaN(val) ? 0 : val; break;
      case "HKQuantityTypeIdentifierActiveEnergyBurned":    a.activeCalories += isNaN(val) ? 0 : val; break;
      case "HKQuantityTypeIdentifierAppleExerciseTime":     a.activeMinutes  += isNaN(val) ? 0 : val; break;
      case "HKQuantityTypeIdentifierDistanceWalkingRunning":a.distKm         += isNaN(val) ? 0 : val / 1000; break;
      case "HKQuantityTypeIdentifierHeartRate":
        if (!isNaN(val)) { a.hrSum += val; a.hrCount++; } break;
      case "HKQuantityTypeIdentifierRestingHeartRate":
        if (!isNaN(val)) { a.hrRestSum += val; a.hrRestCount++; } break;
      case "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
        if (!isNaN(val)) { a.hrvSum += val; a.hrvCount++; } break;
      case "HKQuantityTypeIdentifierOxygenSaturation":
        if (!isNaN(val)) { a.spO2Sum += val * 100; a.spO2Count++; } break;
      case "HKQuantityTypeIdentifierBodyMass":
        if (!isNaN(val)) a.weightLast = val; break;
      case "HKQuantityTypeIdentifierVO2Max":
        if (!isNaN(val)) a.vo2MaxLast = val; break;
      case "HKCategoryTypeIdentifierSleepAnalysis": {
        const v   = attr(tag, "value");
        const min = parseDurationMin(sd, ed);
        if (min <= 0) break;
        if (v.includes("Deep"))  { a.deepMin  += min; a.sleepMin += min; }
        else if (v.includes("REM"))  { a.remMin   += min; a.sleepMin += min; }
        else if (v.includes("Core") || v.includes("Asleep")) { a.sleepMin += min; }
        break;
      }
    }
  }

  // Workout sessions
  const wkRe = /<Workout\s([^>]+?)(?:\s*\/>|>[\s\S]*?<\/Workout>)/g;
  while ((m = wkRe.exec(xml)) !== null) {
    const tag  = m[1];
    const wType = attr(tag, "workoutActivityType").replace("HKWorkoutActivityType", "");
    const sd   = attr(tag, "startDate");
    const ed   = attr(tag, "endDate");
    const cal  = parseFloat(attr(tag, "totalEnergyBurned"));
    if (!sd || !ed) continue;
    const date = parseDate(sd);
    const a    = ensure(date);
    a.workouts.push({
      type:        wType || "Workout",
      durationMin: parseDurationMin(sd, ed),
      calories:    isNaN(cal) ? 0 : Math.round(cal),
    });
  }

  return Object.entries(acc).map(([date, a]) => ({
    date,
    steps:            Math.round(a.steps),
    activeCalories:   Math.round(a.activeCalories),
    activeMinutes:    Math.round(a.activeMinutes),
    heartRateAvg:     a.hrCount     ? Math.round(a.hrSum     / a.hrCount)     : null,
    heartRateResting: a.hrRestCount ? Math.round(a.hrRestSum / a.hrRestCount) : null,
    hrv:              a.hrvCount    ? Math.round(a.hrvSum    / a.hrvCount * 10) / 10 : null,
    spO2:             a.spO2Count   ? Math.round(a.spO2Sum   / a.spO2Count * 10) / 10 : null,
    sleepMinutes:     a.sleepMin    || null,
    sleepDeepMinutes: a.deepMin     || null,
    sleepRemMinutes:  a.remMin      || null,
    distanceKm:       a.distKm > 0  ? Math.round(a.distKm * 100) / 100 : null,
    vo2Max:           a.vo2MaxLast,
    weightKg:         a.weightLast,
    workouts:         a.workouts,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppleHealthCard({ connected: initConnected = false, lastSyncedAt }: Props) {
  const [tab,       setTab]       = useState<"shortcut" | "import">("shortcut");
  const [token,     setToken]     = useState<string | null>(null);
  const [copied,    setCopied]    = useState<"url" | "token" | "json" | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [connected, setConnected] = useState(initConnected);

  // Import state
  const [parseState, setParseState] = useState<"idle" | "reading" | "parsing" | "done" | "sending" | "sent">("idle");
  const [parsedDays,  setParsedDays]  = useState<DayRecord[]>([]);
  const [parseError,  setParseError]  = useState("");
  const [sendProgress, setSendProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/apple-health/token")
      .then(r => r.json())
      .then((d: { token?: string }) => { if (d.token) setToken(d.token); })
      .catch(() => {});
  }, []);

  const generateToken = async () => {
    setGenLoading(true);
    try {
      const r = await fetch("/api/apple-health/token", { method: "POST" });
      const d = await r.json() as { token: string };
      setToken(d.token);
      setConnected(true);
    } finally { setGenLoading(false); }
  };

  const copy = (text: string, key: "url" | "token" | "json") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const webhookUrl  = "https://nutri-tracker-mocha.vercel.app/api/apple-health/ingest";
  const sampleJson  = JSON.stringify({
    token: token ?? "VOTRE_TOKEN",
    date:  "{{Current Date}}",
    steps: "{{Steps}}",
    activeCalories: "{{Active Energy}}",
    heartRateResting: "{{Resting Heart Rate}}",
    sleepMinutes: "{{Sleep Minutes}}",
    hrv: "{{HRV}}",
    spO2: "{{Blood Oxygen}}",
    distanceKm: "{{Distance}}",
    weightKg: "{{Weight}}",
  }, null, 2);

  const handleFile = async (file: File) => {
    setParseError(""); setParseState("reading"); setParsedDays([]); setSendProgress(0);
    try {
      let xml = "";
      if (file.name.endsWith(".zip")) {
        // Dynamically import JSZip
        const JSZip = (await import("jszip")).default;
        const zip   = await JSZip.loadAsync(file);
        const xmlFile = zip.file("apple_health_export/export.xml") ?? zip.file("export.xml");
        if (!xmlFile) { setParseError("export.xml introuvable dans le zip."); setParseState("idle"); return; }
        xml = await xmlFile.async("string");
      } else {
        xml = await file.text();
      }
      setParseState("parsing");
      // Yield to let UI update before heavy parsing
      await new Promise(r => setTimeout(r, 50));
      const days = parseXML(xml);
      setParsedDays(days);
      setParseState("done");
    } catch (e) {
      setParseError(String(e));
      setParseState("idle");
    }
  };

  const handleSend = async () => {
    if (!parsedDays.length) return;
    setParseState("sending"); setSendProgress(0);
    const CHUNK = 100;
    for (let i = 0; i < parsedDays.length; i += CHUNK) {
      const chunk = parsedDays.slice(i, i + CHUNK);
      await fetch("/api/apple-health/import-batch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ days: chunk }),
      });
      setSendProgress(Math.min(100, Math.round(((i + CHUNK) / parsedDays.length) * 100)));
    }
    setConnected(true);
    setParseState("sent");
  };

  const CopyBtn = ({ text, k, label }: { text: string; k: "url" | "token" | "json"; label: string }) => (
    <button
      onClick={() => copy(text, k)}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex-shrink-0"
      style={{
        background: copied === k ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${copied === k ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
        color: copied === k ? "#34d399" : "var(--text-secondary)",
      }}>
      {copied === k ? <Check size={11} weight="bold" /> : <Copy size={11} />}
      {copied === k ? "Copié !" : label}
    </button>
  );

  return (
    <div className="glass p-5 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "linear-gradient(135deg,rgba(255,45,85,0.2),rgba(255,149,0,0.2))", border: "1px solid rgba(255,255,255,0.1)" }}>
            🍎
          </div>
          <div>
            <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Apple Health</p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Pas · FC · Sommeil · HRV · SpO₂ · Poids · Workouts
            </p>
          </div>
        </div>
        {connected
          ? <CheckCircle size={18} weight="fill" style={{ color: "#34d399", flexShrink: 0 }} />
          : <XCircle    size={18} weight="fill" style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        }
      </div>

      {lastSyncedAt && (
        <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
          Dernière sync : {new Date(lastSyncedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
        {(["shortcut", "import"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: tab === t ? "var(--surface-active)" : "transparent",
              color:      tab === t ? "var(--text-primary)"   : "var(--text-muted)",
              border:     tab === t ? "1px solid var(--border-strong)" : "1px solid transparent",
            }}>
            {t === "shortcut" ? "⚡ Shortcut iOS" : "📥 Import XML"}
          </button>
        ))}
      </div>

      {/* ── TAB SHORTCUT ── */}
      {tab === "shortcut" && (
        <div className="space-y-4">
          {/* Token */}
          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Token secret</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-xl font-mono text-[11px] truncate"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {token ? token : <span style={{ color: "var(--text-muted)" }}>Aucun token — générez-en un</span>}
              </div>
              {token && <CopyBtn text={token} k="token" label="Copier" />}
            </div>
            <button onClick={generateToken} disabled={genLoading}
              className="btn btn-ghost gap-1.5 text-[12px] mt-2" style={{ height: "32px" }}>
              {genLoading
                ? <Spinner size={12} className="animate-spin" />
                : <ArrowsClockwise size={12} />
              }
              {token ? "Regénérer" : "Générer un token"}
            </button>
          </div>

          {/* Webhook URL */}
          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>URL du webhook</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-xl font-mono text-[10px] truncate"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {webhookUrl}
              </div>
              <CopyBtn text={webhookUrl} k="url" label="Copier" />
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-xl p-3 space-y-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Configuration du Shortcut iOS
            </p>
            {[
              "Ouvre l'app Raccourcis sur iPhone",
              'Crée un nouveau raccourci → ajoute "Obtenir des données de santé" pour chaque métrique',
              'Ajoute "Obtenir contenu de l\'URL" (méthode POST, JSON)',
              "Colle l'URL ci-dessus et le JSON ci-dessous",
              'Dans "Automatisation" : planifie à 23h55 chaque soir',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(255,45,85,0.15)", color: "#ff2d55" }}>{i + 1}</span>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{step}</p>
              </div>
            ))}
          </div>

          {/* JSON body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Corps JSON du raccourci</p>
              <CopyBtn text={sampleJson} k="json" label="Copier JSON" />
            </div>
            <pre className="text-[10px] p-3 rounded-xl overflow-x-auto"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {sampleJson}
            </pre>
          </div>
        </div>
      )}

      {/* ── TAB IMPORT ── */}
      {tab === "import" && (
        <div className="space-y-4">
          <div className="rounded-xl p-3 space-y-1"
            style={{ background: "rgba(255,149,0,0.06)", border: "1px solid rgba(255,149,0,0.2)" }}>
            <p className="text-[12px] font-medium" style={{ color: "#ff9500" }}>Comment exporter ?</p>
            {[
              "Ouvre l'app Santé → ton profil (en haut à droite)",
              "\"Exporter toutes les données de santé\" → partage le .zip",
              "Transfère le .zip sur ton Mac (AirDrop ou iCloud Drive)",
              "Sélectionne le fichier .zip ci-dessous",
            ].map((s, i) => (
              <p key={i} className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {i + 1}. {s}
              </p>
            ))}
          </div>

          {/* File picker */}
          <AnimatePresence mode="wait">
            {(parseState === "idle" || parseState === "reading" || parseState === "parsing") && (
              <motion.div key="picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <input ref={fileRef} type="file" accept=".xml,.zip" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                <button onClick={() => fileRef.current?.click()}
                  disabled={parseState !== "idle"}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl transition-all text-[13px] font-medium"
                  style={{ background: "rgba(255,149,0,0.08)", border: "2px dashed rgba(255,149,0,0.35)", color: "#ff9500" }}>
                  {parseState === "idle"
                    ? <><UploadSimple size={16} /> Sélectionner export.xml ou .zip</>
                    : <><Spinner size={14} className="animate-spin" />
                      {parseState === "reading" ? "Lecture du fichier…" : "Analyse des données…"}</>
                  }
                </button>
              </motion.div>
            )}

            {parseState === "done" && (
              <motion.div key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Jours",    value: parsedDays.length },
                    { label: "Pas moy.", value: parsedDays.length ? Math.round(parsedDays.reduce((s,d)=>s+d.steps,0)/parsedDays.length).toLocaleString() : "—" },
                    { label: "Avec FC",  value: parsedDays.filter(d=>d.heartRateAvg).length },
                    { label: "Avec sommeil", value: parsedDays.filter(d=>d.sleepMinutes).length },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-3 py-2 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                    </div>
                  ))}
                </div>
                <button onClick={handleSend}
                  className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "42px" }}>
                  Importer {parsedDays.length} jours dans NutriTracker
                </button>
                <button onClick={() => { setParseState("idle"); setParsedDays([]); if (fileRef.current) fileRef.current.value = ""; }}
                  className="btn btn-ghost w-full text-[12px]" style={{ height: "32px" }}>
                  Choisir un autre fichier
                </button>
              </motion.div>
            )}

            {parseState === "sending" && (
              <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <p className="text-[12px] text-center" style={{ color: "var(--text-secondary)" }}>
                  Envoi en cours… {sendProgress}%
                </p>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div className="h-full rounded-full" style={{ background: "#ff9500" }}
                    animate={{ width: `${sendProgress}%` }} transition={{ duration: 0.3 }} />
                </div>
              </motion.div>
            )}

            {parseState === "sent" && (
              <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 py-6">
                <CheckCircle size={36} weight="fill" style={{ color: "#34d399" }} />
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {parsedDays.length} jours importés !
                </p>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Données disponibles dans Santé et Tableau de bord
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {parseError && (
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <Warning size={14} style={{ color: "#f87171" }} />
              <p className="text-[11px]" style={{ color: "#f87171" }}>{parseError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
