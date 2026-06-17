"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { IconChevronLeft, IconChevronRight, IconCalendar } from "@tabler/icons-react";

interface Props {
  date: string;
  basePath?: string;
}

export default function DateNav({ date, basePath = "/log" }: Props) {
  const router    = useRouter();
  const parsed    = parseISO(date);
  const isTdy     = isToday(parsed);
  const today     = format(new Date(), "yyyy-MM-dd");
  const dateInput = useRef<HTMLInputElement>(null);

  const jump = (key: string) => {
    if (!key) return;
    router.push(key === today ? basePath : `${basePath}/${key}`);
  };

  const go = (delta: number) => {
    const next = addDays(parsed, delta);
    jump(format(next, "yyyy-MM-dd"));
  };

  const openPicker = () => {
    const el = dateInput.current;
    if (!el) return;
    // showPicker() is the reliable way to open the native calendar without
    // overlaying a transparent input (which intercepts taps on mobile).
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => go(-1)}
        className="btn-icon"
        aria-label="Jour précédent"
      >
        <IconChevronLeft size={13} stroke={2.5} />
      </button>

      {/* Center — tap to open the date picker and jump to any past day */}
      <button
        type="button"
        onClick={openPicker}
        className="text-center flex-1 select-none"
        aria-label="Choisir une date"
      >
        <span
          className="text-[14px] font-semibold capitalize flex items-center justify-center gap-1"
          style={{ color: isTdy ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {isTdy
            ? "Aujourd'hui"
            : format(parsed, "EEEE d MMMM", { locale: fr })}
          <IconCalendar size={12} stroke={2} style={{ color: "var(--text-muted)", opacity: 0.7 }} />
        </span>
        <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
          {format(parsed, "dd/MM/yyyy")}
        </span>
      </button>

      {/* Hidden native date input (no overlay) */}
      <input
        ref={dateInput}
        type="date"
        value={date}
        max={today}
        onChange={(e) => jump(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => go(+1)}
        disabled={isTdy}
        className="btn-icon disabled:opacity-30"
        aria-label="Jour suivant"
      >
        <IconChevronRight size={13} stroke={2.5} />
      </button>
    </div>
  );
}
