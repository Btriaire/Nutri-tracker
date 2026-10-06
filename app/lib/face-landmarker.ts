"use client";

// Detection des 478 points du visage dans le navigateur (MediaPipe Face Landmarker, WASM).
// Les mesures sont calculees sur le telephone : la photo ne part vers aucun service tiers pour ca.

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { computeFaceMetrics, type FaceMetrics } from "./face-metrics";

const VERSION = "1.0.1";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
let videoLandmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Instance dediee a la video (mode VIDEO : suivi image par image, plus rapide). */
export function getVideoLandmarker(): Promise<FaceLandmarker> {
  if (!videoLandmarkerPromise) {
    videoLandmarkerPromise = create("VIDEO");
    videoLandmarkerPromise.catch(() => { videoLandmarkerPromise = null; });
  }
  return videoLandmarkerPromise;
}

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = create("IMAGE");
    landmarkerPromise.catch(() => { landmarkerPromise = null; }); // permet de reessayer apres un echec reseau
  }
  return landmarkerPromise;
}

async function create(runningMode: "IMAGE" | "VIDEO"): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks(WASM);
  const opts = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode,
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  try {
    return await FaceLandmarker.createFromOptions(files, opts("GPU"));
  } catch {
    return await FaceLandmarker.createFromOptions(files, opts("CPU"));
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

export type FaceMeasureResult = { ok: true; metrics: FaceMetrics } | { ok: false; reason: "no-face" | "error" };

/** Mesure une photo (Blob ou URL de la meme origine). */
export async function measureFace(source: Blob | string): Promise<FaceMeasureResult> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const [landmarker, img] = await Promise.all([getLandmarker(), loadImage(url)]);
    const w = img.naturalWidth, h = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const res = landmarker.detect(canvas);
    const lm = res.faceLandmarks?.[0];
    if (!lm) return { ok: false, reason: "no-face" };
    const { data } = ctx.getImageData(0, 0, w, h);
    const blend: Record<string, number> = {};
    for (const c of res.faceBlendshapes?.[0]?.categories ?? []) blend[c.categoryName] = c.score;
    const metrics = computeFaceMetrics({
      landmarks: lm,
      width: w,
      height: h,
      read: (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; },
      matrix: res.facialTransformationMatrixes?.[0]?.data,
      blendshapes: blend,
    });
    return metrics ? { ok: true, metrics } : { ok: false, reason: "no-face" };
  } catch (e) {
    console.warn("[face] mesure impossible", e);
    return { ok: false, reason: "error" };
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
