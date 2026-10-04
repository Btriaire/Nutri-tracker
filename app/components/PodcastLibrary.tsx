"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { IconDownload, IconPlayerPlayFilled, IconVolume, IconCloudOff, IconRefresh, IconLoader2, IconSparkles } from "@tabler/icons-react";
import { podcastInfo, type PodcastFile, type PodcastStatus } from "@/app/lib/podcasts";

export type PodcastState = "loading" | "ok" | "offline";

/** Liste des podcasts sur le VPS + etat de generation ; sonde toutes les 5 s pendant une generation. */
export function usePodcasts() {
  const [state, setState] = useState<PodcastState>("loading");
  const [files, setFiles] = useState<PodcastFile[]>([]);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/podcast/status", { cache: "no-store" });
      const data = await res.json() as PodcastStatus;
      if (!res.ok || !data.success) { setState("offline"); return; }
      setFiles(data.files ?? []);
      setRunning(!!data.running);
      setState("ok");
    } catch {
      setState("offline");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await refresh(); })();
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [running, refresh]);

  return { state, files, running, setRunning, refresh };
}

const sizeMb = (kb: number) => `${(kb / 1024).toFixed(1).replace(".", ",")} Mo`;

function dateLabel(f: PodcastFile, withYear = false) {
  const { date } = podcastInfo(f.name);
  const d = date ? new Date(`${date}T12:00:00`) : new Date(f.mtime);
  return format(d, withYear ? "EEEE d MMMM yyyy" : "EEE d MMM", { locale: fr });
}

interface Props {
  state: PodcastState;
  files: PodcastFile[];
  onRetry: () => Promise<void>;
}

/** Lecteur unique + liste lisible de tous les podcasts (type, date, taille). */
export default function PodcastLibrary({ state, files, onRetry }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (state === "loading") {
    return (
      <p className="flex items-center gap-2 text-[12px] py-2" style={{ color: "var(--text-muted)" }}>
        <IconLoader2 size={14} className="animate-spin" /> Chargement des podcasts…
      </p>
    );
  }

  if (state === "offline") {
    return (
      <div role="alert" className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--warn) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)" }}>
        <p className="flex items-center gap-2 text-[13px] font-semibold mb-1" style={{ color: "var(--warn)" }}>
          <IconCloudOff size={16} /> Le serveur des podcasts ne répond pas
        </p>
        <p className="text-[12px] mb-2.5" style={{ color: "var(--text-secondary)" }}>
          Tes podcasts ne sont pas perdus : ils sont conservés sur le VPS, qui est saturé en ce moment.
          La liste et la lecture reviendront dès qu&apos;il répondra.
        </p>
        <button type="button" disabled={retrying}
          onClick={async () => { setRetrying(true); await onRetry(); setRetrying(false); }}
          className="flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg text-[13px] font-medium"
          style={{ background: "var(--layer-2)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" }}>
          {retrying ? <IconLoader2 size={14} className="animate-spin" /> : <IconRefresh size={14} />} Réessayer
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return <p className="text-[12px] py-2" style={{ color: "var(--text-muted)" }}>Aucun podcast pour l&apos;instant : le premier arrive samedi matin, ou génère-le maintenant.</p>;
  }

  const current = files.find((f) => f.name === selected) ?? files[0];
  const info = podcastInfo(current.name);
  const list = showAll ? files : files.slice(0, 6);

  return (
    <div>
      {/* Lecteur */}
      <div className="rounded-xl p-3 mb-3" style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold flex items-center gap-1.5" style={{ color: info.long ? "var(--calories)" : "var(--text-primary)" }}>
              {info.long && <IconSparkles size={14} />}{info.kind}
              {current === files[0] && <span className="text-[12px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--layer-2)", color: "var(--text-secondary)" }}>dernier</span>}
            </p>
            <p className="text-[12px] first-letter:uppercase" style={{ color: "var(--text-secondary)" }}>{dateLabel(current, true)} · {sizeMb(current.sizeKb)}</p>
          </div>
          <a href={`/api/podcast/download/${current.name}`} aria-label="Télécharger ce podcast"
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full" style={{ color: "var(--text-secondary)", background: "var(--layer-2)" }}>
            <IconDownload size={17} />
          </a>
        </div>
        <audio key={current.name} controls preload="none" autoPlay={autoPlay} className="w-full" style={{ height: 36 }}
          src={`/api/podcast/download/${current.name}?inline=1`} />
      </div>

      {/* Historique */}
      {files.length > 1 && (
        <>
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Historique · {files.length} podcasts</p>
          <ul className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {list.map((f, i) => {
              const fi = podcastInfo(f.name);
              const active = f.name === current.name;
              return (
                <li key={f.name} style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <button type="button" onClick={() => { setSelected(f.name); setAutoPlay(true); }} aria-current={active}
                    className="w-full flex items-center gap-3 px-3 min-h-[48px] text-left"
                    style={{ background: active ? "var(--layer-2)" : "transparent" }}>
                    <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full"
                      style={{ background: active ? "var(--calories)" : "var(--layer-2)", color: active ? "var(--bg)" : "var(--text-secondary)" }}>
                      {active ? <IconVolume size={14} /> : <IconPlayerPlayFilled size={12} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium" style={{ color: fi.long ? "var(--calories)" : "var(--text-primary)" }}>{fi.kind}</span>
                      <span className="block text-[12px] first-letter:uppercase" style={{ color: "var(--text-muted)" }}>{dateLabel(f)}</span>
                    </span>
                    <span className="text-[12px] tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>{sizeMb(f.sizeKb)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {files.length > 6 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 w-full min-h-[44px] text-[13px] font-medium" style={{ color: "var(--calories)" }}>
              {showAll ? "Réduire" : `Voir les ${files.length} podcasts`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
