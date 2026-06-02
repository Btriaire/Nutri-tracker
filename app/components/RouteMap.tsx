"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GpsPoint } from "@/app/lib/types";

interface Props {
  startMs: number;
  endMs:   number;
  /** Optional pre-loaded points (skips fetch if provided) */
  points?: GpsPoint[];
  /** Width in px, or omit/undefined for 100% */
  width?:  number;
  height?: number;
}

function mercatorX(lng: number): number { return lng; }
function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2)) * (180 / Math.PI);
}

function drawRoute(canvas: HTMLCanvasElement, pts: GpsPoint[]) {
  if (pts.length < 2) return;

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth;
  const H   = canvas.offsetHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  // Project all points
  const xs = pts.map((p) => mercatorX(p.lng));
  const ys = pts.map((p) => mercatorY(p.lat));

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const pad = 20;
  const scaleX = (W - pad * 2) / rangeX;
  const scaleY = (H - pad * 2) / rangeY;
  const scale  = Math.min(scaleX, scaleY);

  // Center the route
  const offX = pad + ((W - pad * 2) - rangeX * scale) / 2;
  const offY = pad + ((H - pad * 2) - rangeY * scale) / 2;

  const toCanvas = (i: number): [number, number] => [
    offX + (xs[i] - minX) * scale,
    H - (offY + (ys[i] - minY) * scale), // flip Y (lat increases upward)
  ];

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.clearRect(0, 0, W, H);

  // ── Glow trail ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor  = "rgba(249,115,22,0.55)";
  ctx.shadowBlur   = 8;
  ctx.strokeStyle  = "rgba(249,115,22,0.9)";
  ctx.lineWidth    = 2.5;
  ctx.lineCap      = "round";
  ctx.lineJoin     = "round";

  ctx.beginPath();
  const [sx, sy] = toCanvas(0);
  ctx.moveTo(sx, sy);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = toCanvas(i);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // ── Start marker (green) ──────────────────────────────────────────────────
  const [startX, startY] = toCanvas(0);
  ctx.beginPath();
  ctx.arc(startX, startY, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#34d399";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── End marker (red) ──────────────────────────────────────────────────────
  const [endX, endY] = toCanvas(pts.length - 1);
  ctx.beginPath();
  ctx.arc(endX, endY, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#f87171";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export default function RouteMap({ startMs, endMs, points: initialPoints, width, height = 180 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pts,     setPts]     = useState<GpsPoint[] | null>(initialPoints ?? null);
  const [loading, setLoading] = useState(!initialPoints);
  const [error,   setError]   = useState(false);

  const fetchRoute = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res  = await fetch(`/api/gfit-route?startMs=${startMs}&endMs=${endMs}`);
      const json = await res.json() as { points: GpsPoint[] };
      if (json.points.length === 0) { setError(true); } else { setPts(json.points); }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [startMs, endMs]);

  useEffect(() => {
    if (!initialPoints) fetchRoute();
  }, [initialPoints, fetchRoute]);

  useEffect(() => {
    if (pts && canvasRef.current) {
      drawRoute(canvasRef.current, pts);
    }
  }, [pts]);

  const containerStyle: React.CSSProperties = {
    width:  width ?? "100%",
    height,
    borderRadius: 12,
    overflow: "hidden",
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(249,115,22,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Chargement tracé…</span>
      </div>
    );
  }

  if (error || (pts && pts.length < 2)) {
    return (
      <div style={containerStyle}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Aucun tracé GPS disponible</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 6, right: 8,
        display: "flex", gap: 8, alignItems: "center",
        fontSize: 10, color: "rgba(255,255,255,0.5)",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
          départ
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f87171", display: "inline-block" }} />
          arrivée
        </span>
      </div>
    </div>
  );
}
