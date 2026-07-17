"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IconCamera, IconSparkles, IconX, IconLoader2, IconTrash,
  IconChevronDown, IconAlertCircle, IconClock,
} from "@tabler/icons-react";
import type { FaceScanEntry, FaceScanConfidence } from "@/app/lib/types";

async function compressImage(file: File, maxSide = 640): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale  = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w      = Math.round(img.width  * scale);
      const h      = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8);
    };
    img.src = url;
  });
}

const CONFIDENCE_COLOR: Record<FaceScanConfidence, string> = {
  "faible": "var(--text-muted)",
  "modérée": "#fbbf24",
  "élevée": "#f87171",
};

const SOURCES = [
  "Bickley, L. — Bates' Guide to Physical Examination and History-Taking (référence classique de sémiologie clinique, pâleur conjonctivale, ictère scléral, xanthélasma, arc cornéen)",
  "Sheth T.N. et al., \"The relation of conjunctival pallor to the presence of anemia\", J Gen Intern Med (1997) — validation clinique de la pâleur conjonctivale comme signe d'anémie",
  "Christoffersen M. et al., \"Xanthelasmata, arcus corneae, and ischaemic vascular disease and death in general population\", BMJ (2011) — xanthélasma/arc cornéen et risque cardiovasculaire",
  "American Stroke Association — protocole FAST (Face, Arms, Speech, Time) pour la détection de l'AVC via l'asymétrie faciale",
];

export default function FaceScanClient() {
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FaceScanEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<FaceScanEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);

  const faceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/face-scan", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as { scans: FaceScanEntry[] };
        setHistory(data.scans ?? []);
      }
    } catch (e) {
      console.error("Failed to fetch face-scan history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCapture = async (file: File) => {
    const blob = await compressImage(file);
    setFaceBlob(blob);
    setFacePreview(URL.createObjectURL(blob));
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!faceBlob) return;
    setAnalyzing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("date", format(new Date(), "yyyy-MM-dd"));
      form.append("face", faceBlob, "face.jpg");
      form.append("compareWithPrevious", compareWithPrevious ? "true" : "false");

      const res = await fetch("/api/face-scan", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json() as { scan: FaceScanEntry };
        setResult(data.scan);
        setHistory(prev => [data.scan, ...prev]);
        setFaceBlob(null);
        setFacePreview(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "L'analyse a échoué. Réessaie.");
      }
    } catch (e) {
      console.error("Face-scan analysis failed:", e);
      setError("Erreur réseau lors de l'analyse.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce scan et sa photo ?")) return;
    try {
      const res = await fetch(`/api/face-scan?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory(prev => prev.filter(s => s.id !== id));
        if (result?.id === id) setResult(null);
      }
    } catch (e) {
      console.error("Failed to delete face scan:", e);
    }
  };

  const renderAnalysis = (scan: FaceScanEntry) => (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {scan.analysis.summary}
      </p>

      {scan.analysis.findings.length > 0 && (
        <div className="space-y-2">
          {scan.analysis.findings.map((f, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{f.indicator}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${CONFIDENCE_COLOR[f.confidence]}18`, color: CONFIDENCE_COLOR[f.confidence] }}>
                  confiance {f.confidence}
                </span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{f.observation}</p>
              <p className="text-[11px] mt-1 italic" style={{ color: "var(--text-secondary)" }}>{f.relevance}</p>
            </div>
          ))}
        </div>
      )}

      {scan.analysis.comparisonNote && (
        <div className="rounded-lg p-3" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--indigo)" }}>Comparaison avec le scan précédent</p>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{scan.analysis.comparisonNote}</p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
        <IconAlertCircle size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
        <p className="text-[10px] leading-relaxed" style={{ color: "#f59e0b" }}>{scan.analysis.disclaimer}</p>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">

        <div className="flex items-center gap-2 mb-5">
          <Link href="/log" className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
            ← Journal
          </Link>
        </div>

        <div className="mb-5">
          <h1 className="text-[20px] font-semibold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
            Scan Visage
          </h1>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Suivi bien-être basé sur des traits visuels documentés scientifiquement — pas un diagnostic médical
          </p>
        </div>

        {/* Capture zone */}
        <div className="glass p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => faceRef.current?.click()}
              className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-[0.95] overflow-hidden relative"
              style={{ background: "rgba(99,102,241,0.06)", border: "2px dashed rgba(99,102,241,0.3)" }}
            >
              {facePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={facePreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <IconCamera size={22} style={{ color: "var(--indigo)" }} />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                {facePreview ? "Photo prête" : "Photo du visage"}
              </p>
              <button
                onClick={() => faceRef.current?.click()}
                className="text-[11px] font-medium mt-0.5"
                style={{ color: "var(--indigo)" }}
              >
                {facePreview ? "Reprendre la photo" : "Prendre une photo"}
              </button>
            </div>
          </div>

          <input ref={faceRef} type="file" accept="image/*" capture="user" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCapture(f); e.target.value = ""; }} />

          {history.length > 0 && (
            <label className="flex items-center gap-2 mb-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <input type="checkbox" checked={compareWithPrevious} onChange={e => setCompareWithPrevious(e.target.checked)} />
              Comparer avec le dernier scan ({format(new Date(history[0].date + "T00:00:00"), "d MMM", { locale: fr })})
            </label>
          )}

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[11px] mb-2" style={{ color: "#f87171" }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            onClick={handleAnalyze}
            disabled={!faceBlob || analyzing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
            style={{ background: "var(--indigo)", color: "#fff" }}
          >
            {analyzing ? <IconLoader2 size={15} className="animate-spin" /> : <IconSparkles size={15} />}
            {analyzing ? "Analyse en cours…" : "Analyser"}
          </button>
        </div>

        {/* Latest result */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Résultat</p>
              <button onClick={() => setResult(null)}><IconX size={16} style={{ color: "var(--text-muted)" }} /></button>
            </div>
            {renderAnalysis(result)}
          </motion.div>
        )}

        {/* Sources */}
        <div className="rounded-xl overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <button type="button" onClick={() => setShowSources(v => !v)} className="w-full flex items-center gap-1.5 px-3 py-2.5">
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Sources</span>
            <IconChevronDown size={13} style={{ color: "var(--text-muted)", marginLeft: "auto", transform: showSources ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
          </button>
          <AnimatePresence>
            {showSources && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                <ul className="px-3 pb-3 space-y-1.5">
                  {SOURCES.map((s, i) => (
                    <li key={i} className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>• {s}</li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History */}
        <div>
          <p className="text-[12px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
            <IconClock size={13} style={{ color: "var(--text-muted)" }} /> Historique
          </p>
          {loadingHistory ? (
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Chargement…</p>
          ) : history.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun scan enregistré</p>
          ) : (
            <div className="space-y-2">
              {history.map(scan => {
                const isOpen = expandedId === scan.id;
                return (
                  <div key={scan.id} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <button
                      onClick={() => setExpandedId(isOpen ? null : scan.id)}
                      className="w-full flex items-center gap-3 p-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={scan.faceImageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                          {format(new Date(scan.date + "T00:00:00"), "d MMMM yyyy", { locale: fr })}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                          {scan.analysis.findings.length} observation{scan.analysis.findings.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <IconChevronDown size={14} style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                          <div className="px-3 pb-3">
                            {renderAnalysis(scan)}
                            <button
                              onClick={() => handleDelete(scan.id)}
                              className="mt-2 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg"
                              style={{ background: "rgba(239,68,68,0.1)", color: "var(--error)" }}
                            >
                              <IconTrash size={12} /> Supprimer
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
