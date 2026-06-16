"use client";

import { useRouter } from "next/navigation";
import { addDays, format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { IconChevronLeft, IconChevronRight, IconCalendar } from "@tabler/icons-react";

interface Props {
  date: string;
  basePath?: string;
}

export default function DateNav({ date, basePath = "/log" }: Props) {
  const router  = useRouter();
  const parsed  = parseISO(date);
  const isTdy   = isToday(parsed);
  const today   = format(new Date(), "yyyy-MM-dd");

  const jump = (key: string) => {
    if (!key) return;
    router.push(key === today ? basePath : `${basePath}/${key}`);
  };

  const go = (delta: number) => {
    const next = addDays(parsed, delta);
    jump(format(next, "yyyy-MM-dd"));
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={() => go(-1)}
        className="btn-icon"
        aria-label="Jour précédent"
      >
        <IconChevronLeft size={13} stroke={2.5} />
      </button>

      {/* Center label — tap to open a date picker and jump to any past day */}
      <label className="text-center flex-1 relative cursor-pointer select-none">
        <p
          className="text-[14px] font-semibold capitalize flex items-center justify-center gap-1"
          style={{ color: isTdy ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {isTdy
            ? "Aujourd'hui"
            : format(parsed, "EEEE d MMMM", { locale: fr })}
          <IconCalendar size={12} stroke={2} style={{ color: "var(--text-muted)", opacity: 0.7 }} />
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {format(parsed, "dd/MM/yyyy")}
        </p>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => jump(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Choisir une date"
        />
      </label>

      <button
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
