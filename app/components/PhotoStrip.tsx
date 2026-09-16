"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { RecentPhoto } from "@/app/api/photos/recent/route";

interface Props {
  photos: RecentPhoto[];
}

function fmtDate(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T12:00:00"), "d MMM", { locale: fr });
  } catch {
    return dateStr;
  }
}

export default function PhotoStrip({ photos }: Props) {
  const [lightbox, setLightbox] = useState<{ dataUrl: string; date: string } | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-2"
      >
        {/* Header */}
        <div className="mb-2 px-1">
          <p className="label-xs">Souvenirs</p>
        </div>

        {/* Horizontal scroll */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {photos.map(({ date, photo }) => (
            <motion.button
              key={photo.id}
              whileTap={{ scale: 0.94 }}
              onClick={() => setLightbox({ dataUrl: photo.dataUrl, date })}
              className="flex-shrink-0 flex flex-col items-center gap-1"
              style={{ width: 56 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.dataUrl}
                alt={`souvenir ${date}`}
                className="object-cover rounded-xl"
                style={{ width: 56, height: 56, border: "1px solid var(--border-strong)" }}
              />
              <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                {fmtDate(date)}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>

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
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-2"
              onClick={e => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.dataUrl}
                alt="souvenir agrandi"
                className="max-w-[88vw] max-h-[78vh] rounded-2xl object-contain"
                style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}
              />
              <p className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                {fmtDate(lightbox.date)}
              </p>
            </motion.div>
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
