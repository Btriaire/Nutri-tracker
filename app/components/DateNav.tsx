"use client";

import { useRouter } from "next/navigation";
import { addDays, format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface Props {
  date: string;
  basePath?: string;
}

export default function DateNav({ date, basePath = "/log" }: Props) {
  const router  = useRouter();
  const parsed  = parseISO(date);
  const isTdy   = isToday(parsed);

  const go = (delta: number) => {
    const next = addDays(parsed, delta);
    const key  = format(next, "yyyy-MM-dd");
    router.push(isToday(next) ? basePath : `${basePath}/${key}`);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={() => go(-1)}
        className="btn-icon"
        aria-label="Jour précédent"
      >
        <CaretLeft size={13} weight="bold" />
      </button>

      <div className="text-center flex-1">
        <p
          className="text-[14px] font-semibold capitalize"
          style={{ color: isTdy ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {isTdy
            ? "Aujourd'hui"
            : format(parsed, "EEEE d MMMM", { locale: fr })}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {format(parsed, "dd/MM/yyyy")}
        </p>
      </div>

      <button
        onClick={() => go(+1)}
        disabled={isTdy}
        className="btn-icon disabled:opacity-30"
        aria-label="Jour suivant"
      >
        <CaretRight size={13} weight="bold" />
      </button>
    </div>
  );
}
