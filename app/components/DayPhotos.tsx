"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DayPhoto } from "@/app/api/photos/route";

interface Props {
  date:           string;
  initialPhotos?: DayPhoto[];
}

// Compress image client-side: resize to max 600px, JPEG 0.65
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else                { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.65));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

export default function DayPhotos({ date, initialPhotos = [] }: Props) {
  const [photos,   setPhotos]   = useState<DayPhoto[]>(initialPhotos);

  // Sync when parent re-fetches on date change
  useEffect(() => { setPhotos(initialPhotos); }, [initialPhotos]);
  const [loading,  setLoading]  = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);   // dataUrl
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 3 - photos.length;
    if (remaining <= 0) return;

    setLoading(true);
    try {
      const toProcess = Array.from(files).slice(0, remaining);
      for (const file of toProcess) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await compressImage(file);
        const res = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, dataUrl }),
        });
        if (res.ok) {
          const data = await res.json() as { photos: DayPhoto[] };
          setPhotos(data.photos);
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [date, photos.length]);

  const handleDelete = useCallback(async (photoId: string) => {
    try {
      const res = await fetch("/api/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, photoId }),
      });
      if (res.ok) {
        const data = await res.json() as { photos: DayPhoto[] };
        setPhotos(data.photos);
      }
    } catch { /* silent */ }
  }, [date]);

  const canAdd = photos.length < 3;

  return (
    <>
      {/* Photo strip row */}
      <div className="flex items-center gap-2">
        {/* Thumbnails */}
        <AnimatePresence mode="popLayout">
          {photos.map(photo => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.25 }}
              className="relative group flex-shrink-0"
              style={{ width: 52, height: 52 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.dataUrl}
                alt="photo du jour"
                onClick={() => setLightbox(photo.dataUrl)}
                className="w-full h-full object-cover rounded-xl cursor-pointer border"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              />
              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(239,68,68,0.9)", fontSize: 9 }}
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add button */}
        {canAdd && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl border border-dashed transition-all"
            style={{
              width: 52, height: 52,
              borderColor: "rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text-muted)",
            }}
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "rgba(255,255,255,0.4)", borderTopColor: "transparent" }} />
            ) : (
              <>
                <span style={{ fontSize: 16 }}>📷</span>
                <span style={{ fontSize: 7, marginTop: 1, color: "var(--text-muted)" }}>
                  {photos.length}/3
                </span>
              </>
            )}
          </motion.button>
        )}

        {/* Caption */}
        {photos.length === 0 && (
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Capture ta journée&nbsp;✨
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.88)" }}
            onClick={() => setLightbox(null)}
          >
            <motion.img
              src={lightbox}
              alt="photo agrandie"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
