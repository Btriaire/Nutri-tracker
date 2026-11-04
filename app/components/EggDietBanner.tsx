"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { eggDayIndex, eggPlanForDay, eggProgramStatus } from "@/app/lib/egg-diet";
import type { EggProgramPrefs } from "@/app/lib/egg-diet";

export default function EggDietBanner({ date, eggProgram, morningSnack }: { date: string; eggProgram: EggProgramPrefs | null; morningSnack: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const isFillingRef = useRef(false);
  const status = eggProgramStatus(eggProgram, date);

  const fill = useCallback(async () => {
    if (isFillingRef.current || !eggProgram) return;
    setIsFilling(true);
    isFillingRef.current = true;
    try {
      const dayIndex = eggDayIndex(eggProgram.startDate, date);
      const entries = eggPlanForDay(dayIndex, { morningSnack });
      const originalFilled = [...eggProgram.filled];
      const patchResponse = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eggProgram: {
            ...eggProgram,
            filled: [...eggProgram.filled, date],
          },
        }),
      });
      if (patchResponse.ok) {
        const response = await fetch("/api/log/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, entries }),
        });
        if (response.ok) {
          router.refresh();
        } else {
          await fetch("/api/goals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eggProgram: {
                ...eggProgram,
                filled: originalFilled,
              },
            }),
          });
          setError("Impossible de remplir la journée.");
        }
      } else {
        setError("Impossible de remplir la journée.");
      }
    } catch {
      setError("Impossible de remplir la journée.");
    } finally {
      setIsFilling(false);
      isFillingRef.current = false;
    }
  }, [date, eggProgram, morningSnack, router]);

  useEffect(() => {
    if (status.active && !status.filled && eggProgram?.autoFill) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (date === todayStr) {
        queueMicrotask(() => { void fill(); });
      }
    }
  }, [date, status.active, status.filled, eggProgram?.autoFill, fill]);

  if (!status.active) return null;

  return (
    <div className="glass px-3 py-2 mb-4 flex items-center justify-between gap-2">
      <span className="text-sm text-[var(--text-primary)]">
        Régime aux œufs · jour {status.day}/{status.total}
      </span>
      {status.filled ? (
        <span className="text-sm text-[var(--text-muted)]">Journée remplie</span>
      ) : (
        <button
          onClick={fill}
          disabled={isFilling}
          className="min-h-[44px] px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--layer-2)] border border-[var(--border)] rounded-md hover:bg-[var(--layer-1)] disabled:opacity-50"
        >
          Remplir la journée
        </button>
      )}
      {error && (
        <div role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </div>
      )}
    </div>
  );
}
