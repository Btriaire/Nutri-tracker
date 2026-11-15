"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sheet from "@/app/components/Sheet";
import EstimatedPeriodsList from "@/app/components/EstimatedPeriodsList";
import { monthGrid, DAY_STATUS_LABEL, type DayStatus } from "@/app/lib/day-status";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

interface Props {
  date: string;
  open: boolean;
  onClose: () => void;
  onSelectRange: (from: string, to: string) => void;
  refreshKey?: number;
}

export default function LogCalendar({ date, open, onClose, onSelectRange, refreshKey = 0 }: Props) {
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const d = new Date(date);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  });
  const [periodMode, setPeriodMode] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [res, setRes] = useState<{ key: string; ok: boolean; goal: number; days: Record<string, { status: DayStatus; kcal: number }> } | null>(null);
  const [bump, setBump] = useState(0);

  const key = `${month.y}-${month.m}-${refreshKey}-${bump}`;
  const loading = open && (!res || res.key !== key);

  useEffect(() => {
    if (!open) return;

    const cancelled = { value: false };
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate();
    const from = `${month.y}-${pad(month.m)}-01`;
    const to = `${month.y}-${pad(month.m)}-${pad(lastDay)}`;

    fetch(`/api/log/month?from=${from}&to=${to}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled.value) {
          setRes({ key, ok: true, goal: data.goal, days: data.days });
        }
      })
      .catch(() => {
        if (!cancelled.value) {
          setRes({ key, ok: false, goal: 0, days: {} });
        }
      });

    return () => {
      cancelled.value = true;
    };
  }, [open, month.y, month.m, key]);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const grid = useMemo(() => monthGrid(month.y, month.m), [month.y, month.m]);

  const handlePrevMonth = () => {
    setMonth((prev) => {
      const m = prev.m - 1;
      return { y: m === 0 ? prev.y - 1 : prev.y, m: m === 0 ? 12 : m };
    });
  };

  const handleNextMonth = () => {
    setMonth((prev) => {
      const m = prev.m + 1;
      return { y: m === 13 ? prev.y + 1 : prev.y, m: m === 13 ? 1 : m };
    });
  };

  const handleDateClick = (d: string | null) => {
    if (!d) return;

    if (periodMode) {
      if (!start) {
        setStart(d);
      } else {
        const from = d < start ? d : start;
        const to = d < start ? start : d;
        onSelectRange(from, to);
        setStart(null);
        setPeriodMode(false);
      }
    } else {
      router.push(d === today ? "/log" : `/log/${d}`);
      onClose();
    }
  };

  const monthName = new Date(Date.UTC(month.y, month.m - 1, 1)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

  const { vides, partiels } = useMemo(() => {
    let vides = 0;
    let partiels = 0;

    grid.forEach((d) => {
      if (!d || d > today) return;
      const status = res?.days[d]?.status ?? "vide";
      if (status === "vide") vides++;
      else if (status === "partiel") partiels++;
    });

    return { vides, partiels };
  }, [grid, res, today]);

  return (
    <Sheet open={open} onClose={onClose} title="Calendrier du journal">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <button onClick={handlePrevMonth} aria-label="Mois précédent" className="min-h-[44px]">
            <IconChevronLeft size={24} />
          </button>
          <h2 className="text-lg font-medium">{monthName}</h2>
          <button onClick={handleNextMonth} aria-label="Mois suivant" className="min-h-[44px]">
            <IconChevronRight size={24} />
          </button>
        </div>
        {loading ? (
          <p>Chargement…</p>
        ) : !res?.ok ? (
          <p>Calendrier indisponible.</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1">
              {["L", "M", "M", "J", "V", "S", "D"].map((day) => (
                <div key={day} className="text-center text-sm font-medium">
                  {day}
                </div>
              ))}
              {grid.map((d, i) => {
                if (!d) return <div key={i} />;

                const status = res.days[d]?.status ?? "vide";
                const kcal = res.days[d]?.kcal;
                const isFuture = d > today;
                const isCurrent = d === today;
                const isSelected = periodMode && start && d >= (start < d ? start : d) && d <= (start < d ? d : start);

                return (
                  <button
                    key={i}
                    onClick={() => handleDateClick(d)}
                    disabled={isFuture}
                    aria-label={`${Number(d.slice(8))} ${monthName} : ${DAY_STATUS_LABEL[status]}${kcal ? `, ${kcal} kcal` : ""}`}
                    className={`min-h-[44px] flex flex-col items-center justify-center ${isSelected ? "bg-[var(--layer-2)]" : ""}`}
                  >
                    <span className={`text-sm ${isCurrent ? "outline outline-2 outline-[var(--accent)] rounded-full" : ""}`}>
                      {Number(d.slice(8))}
                    </span>
                    {!isFuture && (
                      <svg width="14" height="14" aria-hidden="true" className="mt-1">
                        {status === "vide" && (
                          <circle cx="7" cy="7" r="6" fill="none" stroke="var(--text-muted)" strokeWidth="1" />
                        )}
                        {status === "partiel" && (
                          <>
                            <circle cx="7" cy="7" r="6" fill="none" stroke="var(--text-muted)" strokeWidth="1" />
                            <path d="M7 1a6 6 0 0 1 0 12V1z" fill="var(--warning, var(--accent))" />
                          </>
                        )}
                        {status === "estime" && (
                          <>
                            <defs>
                              <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
                                <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="var(--accent)" strokeWidth="1" />
                              </pattern>
                            </defs>
                            <circle cx="7" cy="7" r="6" fill="url(#diagonalHatch)" stroke="var(--text-muted)" strokeWidth="1" />
                          </>
                        )}
                        {status === "complet" && (
                          <circle cx="7" cy="7" r="6" fill="var(--ok)" />
                        )}
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPeriodMode((prev) => !prev)}
                aria-pressed={periodMode}
                className="text-sm font-medium"
              >
                Remplir une période
              </button>
              {periodMode && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {start ? "Touche le dernier jour de la période." : "Touche le premier jour de la période."}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <svg width="14" height="14" aria-hidden="true">
                  <circle cx="7" cy="7" r="6" fill="none" stroke="var(--text-muted)" strokeWidth="1" />
                </svg>
                <span className="text-xs text-[var(--text-secondary)]">Vide</span>
              </div>
              <div className="flex items-center gap-1">
                <svg width="14" height="14" aria-hidden="true">
                  <circle cx="7" cy="7" r="6" fill="none" stroke="var(--text-muted)" strokeWidth="1" />
                  <path d="M7 1a6 6 0 0 1 0 12V1z" fill="var(--warning, var(--accent))" />
                </svg>
                <span className="text-xs text-[var(--text-secondary)]">Partiel</span>
              </div>
              <div className="flex items-center gap-1">
                <svg width="14" height="14" aria-hidden="true">
                  <defs>
                    <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
                      <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="var(--accent)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <circle cx="7" cy="7" r="6" fill="url(#diagonalHatch)" stroke="var(--text-muted)" strokeWidth="1" />
                </svg>
                <span className="text-xs text-[var(--text-secondary)]">Estime</span>
              </div>
              <div className="flex items-center gap-1">
                <svg width="14" height="14" aria-hidden="true">
                  <circle cx="7" cy="7" r="6" fill="var(--ok)" />
                </svg>
                <span className="text-xs text-[var(--text-secondary)]">Complet</span>
              </div>
            </div>
            <p className="text-sm">
              {vides} jours vides et {partiels} partiels ce mois-ci
            </p>
            <div className="mt-4">
              <EstimatedPeriodsList refreshKey={refreshKey + bump} onChanged={() => { setBump(b => b + 1); router.refresh(); }} />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
