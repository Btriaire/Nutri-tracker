"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { IconX } from "@tabler/icons-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Feuille basse accessible : portal, role=dialog, Echap, focus pris puis rendu,
// focus piege dans la feuille, defilement du fond bloque, zone sure iPhone.
export default function Sheet({ open, onClose, title, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnFocus.current?.focus();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="sheet-backdrop" className="fixed inset-0 z-[200]"
            style={{ background: "rgba(3,2,10,0.72)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
          <motion.div key="sheet-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={title}
            className="fixed bottom-0 left-0 right-0 z-[201] mx-auto max-w-md"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}>
            <div className="rounded-t-[28px] px-5 pt-3"
              style={{
                background: "var(--surface-hover)",
                border: "1px solid var(--border-strong)",
                borderBottom: "none",
                boxShadow: "0 -12px 40px rgba(0,0,0,0.45)",
                maxHeight: "85dvh",
                overflowY: "auto",
                overscrollBehavior: "contain",
                paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
              }}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "var(--border-strong)" }} />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
                <button type="button" onClick={onClose} aria-label="Fermer"
                  className="flex items-center justify-center w-11 h-11 -mr-2 rounded-full"
                  style={{ color: "var(--text-secondary)" }}>
                  <IconX size={20} stroke={2} />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
