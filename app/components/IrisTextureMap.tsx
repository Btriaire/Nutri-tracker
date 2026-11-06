"use client";

import { useEffect, useRef, useState } from "react";
import { irisTexture, textureMaps, type IrisTexture } from "@/app/lib/eye-iris-texture";
import { HVID_MM } from "@/app/lib/eye-metrics";

// La photo isolee est un carre de 320 px centre sur l'iris, large de 3 diametres d'iris (voir eye-reanalyze).
const CROP = 320, IRIS_D = CROP / 3;

type Maps = NonNullable<ReturnType<typeof textureMaps>>;

/**
 * Texture lue directement sur la photo enregistree de l'oeil : aucune action a lancer, aucun enregistrement.
 * Sert pour la carte, et a la place de la valeur enregistree quand le scan n'en a pas encore.
 */
export function useIrisPhoto(imageUrl: string | null, pupilMm: number | null): { status: "loading" | "ok" | "none"; maps: Maps | null; texture: IrisTexture | null } {
  const [res, setRes] = useState<{ key: string; status: "ok" | "none"; maps: Maps | null; texture: IrisTexture | null } | null>(null);
  const key = `${imageUrl}|${pupilMm}`;

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await fetch(imageUrl).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("photo"))));
        const bmp = await createImageBitmap(blob);
        const cv = document.createElement("canvas");
        cv.width = CROP; cv.height = CROP;
        const g = cv.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(bmp, 0, 0, CROP, CROP);
        const px = g.getImageData(0, 0, CROP, CROP).data;
        const read = (x: number, y: number): [number, number, number] => {
          const i = (Math.min(CROP - 1, Math.max(0, Math.round(y))) * CROP + Math.min(CROP - 1, Math.max(0, Math.round(x)))) * 4;
          return [px[i], px[i + 1], px[i + 2]];
        };
        const R = IRIS_D / 2, mmPerPx = HVID_MM / IRIS_D, c = { x: CROP / 2, y: CROP / 2 };
        const pupilR = pupilMm != null ? pupilMm / 2 / mmPerPx : R * 0.3;
        const maps = textureMaps(read, c, R, pupilR, CROP, CROP);
        const texture = maps ? irisTexture(read, c, R, pupilR, CROP, CROP) : null;
        if (!cancelled) setRes({ key, status: maps ? "ok" : "none", maps, texture });
      } catch {
        if (!cancelled) setRes({ key, status: "none", maps: null, texture: null });
      }
    })();
    return () => { cancelled = true; };
  }, [imageUrl, pupilMm, key]);

  if (!imageUrl) return { status: "none", maps: null, texture: null };
  if (!res || res.key !== key) return { status: "loading", maps: null, texture: null };
  return res;
}

/**
 * Bande de l'iris deroulee (bord de la pupille en haut, peripherie en bas ; de gauche a droite, la moitie basse
 * de l'iris parcourue du cote droit de la photo vers le cote gauche, par le bas), relief accentue, cryptes en violet.
 */
export default function IrisTextureMap({ maps }: { maps: Maps }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const nR = maps.detail.length, nA = maps.detail[0].length;
    cv.width = nA; cv.height = nR;
    const out = cv.getContext("2d")!;
    const img = out.createImageData(nA, nR);
    for (let i = 0; i < nR; i++) for (let j = 0; j < nA; j++) {
      const k = (i * nA + j) * 4, d = maps.detail[i][j];
      if (!Number.isFinite(d)) { img.data[k] = 30; img.data[k + 1] = 30; img.data[k + 2] = 34; img.data[k + 3] = 255; continue; }
      if (maps.crypt[i][j]) { img.data[k] = 192; img.data[k + 1] = 132; img.data[k + 2] = 252; img.data[k + 3] = 255; continue; }
      const v = Math.max(0, Math.min(255, 128 + d * 9));   // relief accentue autour du gris moyen
      img.data[k] = v; img.data[k + 1] = v * 0.92; img.data[k + 2] = v * 0.82; img.data[k + 3] = 255;
    }
    out.putImageData(img, 0, 0);
  }, [maps]);

  return (
    <div className="mt-2">
      <canvas ref={ref} className="w-full rounded-md" style={{ height: 56, imageRendering: "pixelated", background: "var(--layer-1)" }}
        aria-label="Bande de l'iris déroulée, cryptes surlignées" role="img" />
      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        <span>↑ bord de la pupille · ↓ périphérie</span>
        <span><span style={{ color: "#c084fc" }}>■</span> cryptes</span>
      </div>
    </div>
  );
}
