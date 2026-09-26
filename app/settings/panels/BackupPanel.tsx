"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { IconCheck, IconX, IconLoader2, IconCloudUpload } from "@tabler/icons-react";

interface Entry { at: string; set: string | null; ok: boolean; totalDocs?: number; sizeBytes?: number; gzBytes?: number; error?: string }
interface History { entries: Entry[]; pending: boolean }

const size = (b?: number) => (b == null ? "—" : b >= 1e6 ? `${(b / 1e6).toFixed(1).replace(".", ",")} Mo` : `${Math.round(b / 1e3)} Ko`);

export default function BackupPanel() {
  const [data, setData] = useState<History | null>(null);
  const [failed, setFailed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/backup/history");
      if (!res.ok) throw new Error();
      setData(await res.json() as History);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    fetch("/api/backup/history")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: History) => setData(d))
      .catch(() => setFailed(true));
  }, []);

  // Tant qu'une demande est en attente, on surveille l'arrivee de la sauvegarde.
  const pending = data?.pending ?? false;
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(id);
  }, [pending, load]);

  const request = async () => {
    setRequesting(true);
    try {
      const res = await fetch("/api/backup/request", { method: "POST" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setFailed(true);
    } finally {
      setRequesting(false);
    }
  };

  const entries = data?.entries ?? [];
  const visible = showAll ? entries : entries.slice(0, 5);

  return (
    <section aria-label="Sauvegardes" className="glass p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Sauvegardes</p>
          <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            {pending ? "Demandée · le VPS la récupère sous 5 minutes" : "Copie automatique chaque nuit sur ton VPS"}
          </p>
        </div>
        <button type="button" onClick={request} disabled={requesting || pending}
          className="flex-shrink-0 flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-[13px] font-semibold disabled:opacity-60"
          style={{ background: "linear-gradient(90deg, var(--protein), var(--steps))", color: "var(--bg)" }}>
          {requesting || pending ? <IconLoader2 size={16} className="animate-spin" /> : <IconCloudUpload size={16} stroke={2.2} />}
          {pending ? "En cours" : "Sauvegarder"}
        </button>
      </div>

      {failed && <p role="alert" className="text-[12px] mb-2" style={{ color: "var(--danger)" }}>Impossible de charger l&apos;état des sauvegardes.</p>}
      {data && entries.length === 0 && <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucune sauvegarde enregistrée pour l&apos;instant.</p>}

      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {visible.map((e) => (
          <li key={e.at} className="flex items-center gap-3 py-2.5" style={{ borderColor: "var(--border)" }}>
            <span className="flex-shrink-0" style={{ color: e.ok ? "var(--fiber)" : "var(--danger)" }} aria-label={e.ok ? "Réussie" : "Échouée"}>
              {e.ok ? <IconCheck size={18} stroke={2.4} /> : <IconX size={18} stroke={2.4} />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                {format(parseISO(e.at), "EEE d MMM · HH:mm", { locale: fr })}
                {e.set && <span style={{ color: "var(--text-muted)" }}> · photos ({e.set})</span>}
              </p>
              <p className="text-[12px]" style={{ color: e.ok ? "var(--text-secondary)" : "var(--danger)" }}>
                {e.ok ? `${e.totalDocs ?? "?"} documents · ${size(e.gzBytes ?? e.sizeBytes)}` : e.error ?? "Échec"}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {entries.length > 5 && (
        <button type="button" onClick={() => setShowAll(v => !v)}
          className="mt-2 min-h-[44px] w-full text-[13px] font-medium" style={{ color: "var(--protein)" }}>
          {showAll ? "Réduire" : `Voir les ${entries.length} dernières`}
        </button>
      )}
    </section>
  );
}
