"use client";

import { useState } from "react";
import { IconClock, IconCheck, IconRestore } from "@tabler/icons-react";
import Sheet from "./Sheet";
import { MEAL_META } from "./meal-meta";
import { mealTimeFromInput } from "@/app/lib/glucose";
import type { MealType } from "@/app/lib/types";

interface Props {
  meal:        MealType | null;                 // null = ferme
  date:        string;                          // YYYY-MM-DD du journal
  currentMs:   number | null;                   // heure retenue aujourd'hui pour ce repas
  loggedMs:    number | null;                   // heure de saisie du premier aliment
  overridden:  boolean;
  onSave:      (meal: MealType, timeMs: number | null) => void;   // null = revenir a l'heure de saisie
  onClose:     () => void;
}

const hhmm = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "");

// Le corps est monte seulement a l'ouverture (key = repas) : le champ repart toujours de l'heure retenue.
function Body({ meal, date, currentMs, loggedMs, overridden, onSave, onClose }: Props & { meal: MealType }) {
  const [value, setValue] = useState(hhmm(currentMs) || "12:00");
  const valid = mealTimeFromInput(date, value, meal) !== null;
  const meta = MEAL_META[meal];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const ms = mealTimeFromInput(date, value, meal);
        if (ms !== null) { onSave(meal, ms); onClose(); }
      }}
    >
      <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        L&apos;heure à laquelle tu as réellement mangé. Elle sert à relier ce repas à ta glycémie
        (avant, pic, 2 h après) — pas besoin de saisir les aliments au moment du repas.
      </p>
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
          style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}>
          <meta.Icon size={18} />
        </span>
        <IconClock size={18} style={{ color: "var(--text-muted)" }} />
        <label htmlFor="meal-time" className="sr-only">Heure du repas</label>
        <input id="meal-time" type="time" value={value} onChange={(e) => setValue(e.target.value)} className="input flex-1" style={{ height: 48 }} autoFocus />
      </div>
      <button type="submit" disabled={!valid} className="btn btn-primary w-full gap-2 disabled:opacity-50" style={{ height: 48 }}>
        <IconCheck size={16} stroke={2.4} /> Enregistrer
      </button>
      {overridden && loggedMs && (
        <button type="button" onClick={() => { onSave(meal, null); onClose(); }}
          className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl text-[13px] font-medium"
          style={{ color: "var(--text-secondary)" }}>
          <IconRestore size={16} /> Revenir à l&apos;heure de saisie ({hhmm(loggedMs)})
        </button>
      )}
    </form>
  );
}

export default function MealTimeSheet(props: Props) {
  const { meal, onClose } = props;
  return (
    <Sheet open={meal !== null} onClose={onClose} title={meal ? `Heure · ${MEAL_META[meal].fr}` : "Heure du repas"}>
      {meal && <Body key={meal} {...props} meal={meal} />}
    </Sheet>
  );
}
