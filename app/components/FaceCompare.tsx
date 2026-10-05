"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { alignTransform, type FaceMetrics } from "@/app/lib/face-metrics";

type Scan = { id: string; date: string; metrics: FaceMetrics };

const W = 300, H = 360;
const TARGET = { le: { x: 108, y: 150 }, re: { x: 192, y: 150 } };

/** Dessine la photo d'un scan, mise a l'echelle et redressee pour que les yeux tombent toujours au meme endroit. */
function AlignedCanvas({ scan, className, style }: { scan: Scan; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.setTransform(...alignTransform(scan.metrics.anchors, img.naturalWidth, img.naturalHeight, TARGET));
      ctx.drawImage(img, 0, 0);
    };
    img.src = `/api/face-scan/image?id=${scan.id}`;
  }, [scan]);
  return <canvas ref={ref} width={W} height={H} className={className} style={style} aria-hidden />;
}

/** Avant / apres aligne sur les yeux, avec un curseur pour balayer entre les deux photos. */
export default function FaceCompare({ scans }: { scans: Scan[] }) {
  const sorted = [...scans].sort((a, b) => a.date.localeCompare(b.date));
  const good = sorted.filter((s) => s.metrics.quality.score >= 60);
  const pool = good.length >= 2 ? good : sorted;
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [pos, setPos] = useState(50);
  if (pool.length < 2) return null;

  const a = pool.find((s) => s.id === aId) ?? pool[0];
  const b = pool.find((s) => s.id === bId) ?? pool[pool.length - 1];
  const label = (s: Scan) => format(parseISO(s.date), "d MMM yyyy", { locale: fr });

  const picker = (value: Scan, set: (id: string) => void, aria: string) => (
    <select value={value.id} onChange={(e) => set(e.target.value)} aria-label={aria}
      className="min-h-[40px] px-2 rounded-lg text-[13px] max-w-[46%]"
      style={{ background: "var(--layer-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
      {pool.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
    </select>
  );

  return (
    <section aria-label="Avant après" className="glass p-4 mb-4">
      <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Avant / après aligné</h2>
      <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
        Les deux photos sont redressées et mises à la même échelle sur la position des yeux : fais glisser pour comparer
        joues, mâchoire et cernes.
      </p>
      <div className="flex items-center justify-between gap-2 mb-2">
        {picker(a, setAId, "Photo de gauche (avant)")}
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>→</span>
        {picker(b, setBId, "Photo de droite (après)")}
      </div>
      <div className="relative mx-auto rounded-xl overflow-hidden" style={{ width: "100%", maxWidth: W, aspectRatio: `${W} / ${H}` }}>
        <AlignedCanvas scan={a} className="absolute inset-0 w-full h-full" />
        <AlignedCanvas scan={b} className="absolute inset-0 w-full h-full" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
        <div className="absolute top-0 bottom-0 w-[2px] pointer-events-none" style={{ left: `${pos}%`, background: "#fff", boxShadow: "0 0 6px rgba(0,0,0,.6)" }} />
        <span className="absolute top-2 left-2 text-[12px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,.55)", color: "#fff" }}>{label(a)}</span>
        <span className="absolute top-2 right-2 text-[12px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,.55)", color: "#fff" }}>{label(b)}</span>
        {/* Repere des yeux : montre que l'alignement est le meme sur les deux photos */}
        <div className="absolute pointer-events-none" style={{ left: 0, right: 0, top: `${(TARGET.le.y / H) * 100}%`, borderTop: "1px dashed rgba(255,255,255,.25)" }} />
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Balayer entre les deux photos" className="w-full mt-3" />
    </section>
  );
}
