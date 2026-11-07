"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { irisTexture, textureMaps, type IrisTexture } from "@/app/lib/eye-iris-texture";
import { HVID_MM } from "@/app/lib/eye-metrics";
import { glcmFeatures, cellAt } from "@/app/lib/eye-iris-glcm";

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
// Couleurs des calques (le canvas demande du RGB) : zone lue, cryptes, sillons, cases ecartees.
const ZONE = [129, 140, 248], CRYPT = [192, 132, 252], FURROW = [45, 212, 191], SKIP = [248, 113, 113];

export default function IrisTextureMap({ maps, imageUrl }: { maps: Maps; imageUrl: string | null }) {
  const ref1 = useRef<HTMLCanvasElement>(null);
  const ref2 = useRef<HTMLCanvasElement>(null);


  useEffect(() => {
    const cv = ref1.current;
    if (!cv || !imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      cv.width = CROP; cv.height = CROP;
      const g = cv.getContext("2d")!;
      g.drawImage(img, 0, 0, CROP, CROP);
      const px = g.getImageData(0, 0, CROP, CROP);
      const data = px.data;
      for (let y = 0; y < CROP; y++) {
        for (let x = 0; x < CROP; x++) {
          const i = (y * CROP + x) * 4;
          const cell = cellAt({ r0: maps.r0, r1: maps.r1, nR: maps.detail.length, nA: maps.detail[0].length }, { x: x + 0.5, y: y + 0.5 }, { x: 160, y: 160 });
          if (cell) {
            if (!Number.isFinite(maps.detail[cell[0]][cell[1]])) {
              if ((x + y) % 6 < 3) {
                data[i] = (data[i] * 0.45 + SKIP[0] * 0.55) | 0;
                data[i + 1] = (data[i + 1] * 0.45 + SKIP[1] * 0.55) | 0;
                data[i + 2] = (data[i + 2] * 0.45 + SKIP[2] * 0.55) | 0;
              }
            } else if (maps.crypt[cell[0]][cell[1]]) {
              data[i] = (data[i] * 0.3 + CRYPT[0] * 0.7) | 0;
              data[i + 1] = (data[i + 1] * 0.3 + CRYPT[1] * 0.7) | 0;
              data[i + 2] = (data[i + 2] * 0.3 + CRYPT[2] * 0.7) | 0;
            } else if (maps.furrow[cell[0]][cell[1]]) {
              data[i] = (data[i] * 0.3 + FURROW[0] * 0.7) | 0;
              data[i + 1] = (data[i + 1] * 0.3 + FURROW[1] * 0.7) | 0;
              data[i + 2] = (data[i + 2] * 0.3 + FURROW[2] * 0.7) | 0;
            } else {
              data[i] = (data[i] * 0.78 + ZONE[0] * 0.22) | 0;
              data[i + 1] = (data[i + 1] * 0.78 + ZONE[1] * 0.22) | 0;
              data[i + 2] = (data[i + 2] * 0.78 + ZONE[2] * 0.22) | 0;
            }
          } else {
            data[i] *= 0.45; data[i + 1] *= 0.45; data[i + 2] *= 0.45;
          }
        }
      }
      g.putImageData(px, 0, 0);
    };
  }, [maps, imageUrl]);

  useEffect(() => {
    const cv = ref2.current;
    if (!cv) return;
    const nR = maps.detail.length, nA = maps.detail[0].length;
    cv.width = nA; cv.height = nR;
    const out = cv.getContext("2d")!;
    const img = out.createImageData(nA, nR);
    const flat = maps.detail.flat().filter(Number.isFinite);
    flat.sort((a, b) => a - b);
    const lo = flat[Math.floor(flat.length * 0.02)], hi = flat[Math.floor(flat.length * 0.98)];
    for (let i = 0; i < nR; i++) for (let j = 0; j < nA; j++) {
      const k = (i * nA + j) * 4, d = maps.detail[i][j];
      if (!Number.isFinite(d)) {
        if ((i + j) % 6 < 3) {
          img.data[k] = SKIP[0]; img.data[k + 1] = SKIP[1]; img.data[k + 2] = SKIP[2]; img.data[k + 3] = 255;
        } else {
          img.data[k] = 30; img.data[k + 1] = 30; img.data[k + 2] = 34; img.data[k + 3] = 255;
        }
        continue;
      }
      const v = Math.max(0, Math.min(255, Math.round(255 * (d - lo) / (hi - lo))));
      if (maps.crypt[i][j]) {
        img.data[k] = (v * 0.3 + CRYPT[0] * 0.7) | 0;
        img.data[k + 1] = (v * 0.3 + CRYPT[1] * 0.7) | 0;
        img.data[k + 2] = (v * 0.3 + CRYPT[2] * 0.7) | 0;
        img.data[k + 3] = 255;
      } else if (maps.furrow[i][j]) {
        img.data[k] = (v * 0.3 + FURROW[0] * 0.7) | 0;
        img.data[k + 1] = (v * 0.3 + FURROW[1] * 0.7) | 0;
        img.data[k + 2] = (v * 0.3 + FURROW[2] * 0.7) | 0;
        img.data[k + 3] = 255;
      } else {
        img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v; img.data[k + 3] = 255;
      }
    }
    out.putImageData(img, 0, 0);
  }, [maps]);

  const g = useMemo(() => glcmFeatures(maps.detail), [maps]);

  return (
    <div className="mt-2">
      <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>Zone analysée</h3>
      <canvas ref={ref1} className="w-full rounded-md" style={{ aspectRatio: "1", background: "var(--layer-1)" }}
        aria-label="Photo de l'œil avec la zone analysée" role="img" />
      <h3 className="text-[12px] font-semibold mt-2" style={{ color: "var(--text-primary)" }}>Bande déroulée</h3>
      <canvas ref={ref2} className="w-full rounded-md" style={{ height: 112, imageRendering: "pixelated", background: "var(--layer-1)" }}
        aria-label="Bande de l'iris déroulée, cryptes et sillons surlignés" role="img" />
      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        En haut : bord de la pupille · en bas : périphérie. De gauche à droite : la moitié basse de l&apos;iris, côté droit de la photo vers côté gauche.
      </div>
      <div className="flex flex-wrap gap-2 mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        <div className="flex items-center gap-1">
          <div className="w-[10px] h-[10px]" style={{ backgroundColor: `rgb(${ZONE.join(",")})` }}></div>
          <span>zone lue</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-[10px] h-[10px]" style={{ backgroundColor: `rgb(${CRYPT.join(",")})` }}></div>
          <span>cryptes</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-[10px] h-[10px]" style={{ backgroundColor: `rgb(${FURROW.join(",")})` }}></div>
          <span>sillons</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-[10px] h-[10px]" style={{ backgroundColor: `rgb(${SKIP.join(",")})` }}></div>
          <span>écarté (reflet, cil)</span>
        </div>
      </div>
      {g && (
        <>
          <h3 className="text-[12px] font-semibold mt-2" style={{ color: "var(--text-primary)" }}>Paramètres de texture (GLCM)</h3>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-[var(--layer-1)] rounded-md p-2 text-[11px]">
              <div className="font-semibold">Contraste</div>
              <div>{g.contrast.toFixed(2)}</div>
              <div style={{ color: "var(--text-muted)" }}>écarts entre points voisins : plus haut = détails plus marqués</div>
            </div>
            <div className="bg-[var(--layer-1)] rounded-md p-2 text-[11px]">
              <div className="font-semibold">Homogénéité</div>
              <div>{g.homogeneity.toFixed(2)}</div>
              <div style={{ color: "var(--text-muted)" }}>points voisins semblables : plus haut = iris plus lisse</div>
            </div>
            <div className="bg-[var(--layer-1)] rounded-md p-2 text-[11px]">
              <div className="font-semibold">Énergie</div>
              <div>{g.energy.toFixed(2)}</div>
              <div style={{ color: "var(--text-muted)" }}>répétition des mêmes motifs : plus haut = texture plus uniforme</div>
            </div>
            <div className="bg-[var(--layer-1)] rounded-md p-2 text-[11px]">
              <div className="font-semibold">Corrélation</div>
              <div>{g.correlation.toFixed(2)}</div>
              <div style={{ color: "var(--text-muted)" }}>continuité des fibres : plus haut = structures plus suivies</div>
            </div>
            <div className="bg-[var(--layer-1)] rounded-md p-2 text-[11px]">
              <div className="font-semibold">Entropie (bits)</div>
              <div>{g.entropy.toFixed(1)}</div>
              <div style={{ color: "var(--text-muted)" }}>désordre de la texture : plus haut = plus varié</div>
            </div>
            <div className="bg-[var(--layer-1)] rounded-md p-2 text-[11px]">
              <div className="font-semibold">Anisotropie</div>
              <div>{(g.anisotropy * 100).toFixed(0)}&apos;%</div>
              <div style={{ color: "var(--text-muted)" }}>{g.anisotropy > 0.15 ? "détails surtout radiaires (fibres)" : g.anisotropy < -0.15 ? "détails surtout en anneaux (sillons)" : "sans direction dominante"}</div>
            </div>
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Méthode : matrice de co-occurrence sur la bande, éclairage retiré, <a href="https://doi.org/10.1109/TSMC.1973.4309314" target="_blank" rel="noreferrer" style={{ color: "var(--indigo)", textDecoration: "underline" }}>Haralick et al., IEEE Trans SMC, 1973</a>. Ces valeurs décrivent la photo ; comparées d&apos;un scan à l&apos;autre, elles dépendent surtout de la netteté.
          </div>
        </>
      )}
    </div>
  );
}
