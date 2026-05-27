"use client";

import { useState } from "react";
import { Trash, CaretDown } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import type { FoodEntry } from "@/app/lib/types";

const SOURCE_DOT: Record<string, string> = {
  ciqual: "var(--fiber)",
  off:    "var(--steps)",
  usda:   "var(--carbs)",
  custom: "var(--protein)",
};

// Keyword → emoji mapping (order matters — first match wins)
function foodEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/poulet|dinde|volaille|canard|pintade/.test(n)) return "🍗";
  if (/bœuf|boeuf|steak|bifteck|entrecôte|veau/.test(n)) return "🥩";
  if (/porc|jambon|lard|bacon|saucisse|chorizo|salami/.test(n)) return "🥓";
  if (/agneau|mouton/.test(n)) return "🍖";
  if (/saumon|thon|sardine|cabillaud|truite|dorade|bar|tilapia|sole/.test(n)) return "🐟";
  if (/crevette|homard|crabe|moule|huître|fruit de mer/.test(n)) return "🦐";
  if (/œuf|omelette|tortilla/.test(n)) return "🥚";
  if (/lait|yaourt|fromage|beurre|crème|ricotta|mozzarella|camembert|gruyère|emmental|cheddar/.test(n)) return "🧀";
  if (/riz|paella/.test(n)) return "🍚";
  if (/pâte|spaghetti|tagliatelle|penne|fusilli|ravioli|gnocchi/.test(n)) return "🍝";
  if (/pain|baguette|brioche|toast|tartine/.test(n)) return "🍞";
  if (/croissant/.test(n)) return "🥐";
  if (/pizza/.test(n)) return "🍕";
  if (/burger|hamburger/.test(n)) return "🍔";
  if (/sandwich|wrap|burrito|tacos|fajita/.test(n)) return "🌮";
  if (/soupe|bouillon|velouté/.test(n)) return "🍜";
  if (/salade/.test(n)) return "🥗";
  if (/pomme de terre|frite|patate|purée/.test(n)) return "🥔";
  if (/carotte|céleri|brocoli|choufleur|épinard|courgette|poivron|aubergine|haricot vert/.test(n)) return "🥦";
  if (/tomate/.test(n)) return "🍅";
  if (/concombre/.test(n)) return "🥒";
  if (/maïs/.test(n)) return "🌽";
  if (/avocat/.test(n)) return "🥑";
  if (/banane/.test(n)) return "🍌";
  if (/pomme/.test(n)) return "🍎";
  if (/raisin/.test(n)) return "🍇";
  if (/fraise/.test(n)) return "🍓";
  if (/orange|mandarine|clémentine/.test(n)) return "🍊";
  if (/citron/.test(n)) return "🍋";
  if (/cerise/.test(n)) return "🍒";
  if (/pêche|abricot|nectarine/.test(n)) return "🍑";
  if (/melon|pastèque/.test(n)) return "🍉";
  if (/ananas/.test(n)) return "🍍";
  if (/mangue|papaye/.test(n)) return "🥭";
  if (/noix|amande|noisette|cacahuète|cajou|pistache/.test(n)) return "🥜";
  if (/chocolat/.test(n)) return "🍫";
  if (/gâteau|tarte|cake|cookie|biscuit|madeleine/.test(n)) return "🍰";
  if (/glace|sorbet/.test(n)) return "🍦";
  if (/miel/.test(n)) return "🍯";
  if (/confiture|jam/.test(n)) return "🫙";
  if (/huile|margarine/.test(n)) return "🧴";
  if (/café/.test(n)) return "☕";
  if (/thé/.test(n)) return "🍵";
  if (/jus|smoothie/.test(n)) return "🧃";
  if (/soda|cola|limonade/.test(n)) return "🥤";
  if (/eau/.test(n)) return "💧";
  if (/vin/.test(n)) return "🍷";
  if (/bière/.test(n)) return "🍺";
  if (/lentille|pois chiche|haricot|fève/.test(n)) return "🫘";
  if (/quinoa|boulgour|épeautre|seigle|avoine|céréale|flocon|muesli|granola/.test(n)) return "🌾";
  if (/crêpe|galette|pancake/.test(n)) return "🥞";
  if (/épice|herbe|ail|oignon|échalote|poivre|sel|curry|curcuma|gingembre/.test(n)) return "🌿";
  if (/sauce|ketchup|mayonnaise|moutarde|vinaigrette/.test(n)) return "🫙";
  if (/tofu|tempeh|seitan|protéine végétale/.test(n)) return "🌱";
  if (/algue/.test(n)) return "🫛";
  return "🍽️";
}

interface MicroRow { label: string; value: number | undefined; unit: string; color?: string }

function formatMicro(v: number | undefined, unit: string): string {
  if (v == null || v === 0) return "—";
  return `${unit === "mg" ? (v < 1 ? "<1" : Math.round(v)) : v.toFixed(1)} ${unit}`;
}

interface Props {
  entry:    FoodEntry;
  date:     string;
  onDelete: (id: string) => void;
}

export default function FoodItem({ entry, date, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const n = entry.nutrition;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    await fetch(`/api/log/${entry.id}?date=${date}`, { method: "DELETE" });
    onDelete(entry.id);
  };

  const microRows: MicroRow[] = [
    // Detailed carbs
    { label: "Sucres",           value: n.sugarG,         unit: "g",  color: "var(--carbs)" },
    // Detailed fats
    { label: "Sat. grasses",     value: n.saturatedFatG,  unit: "g",  color: "var(--fat)" },
    { label: "Trans",            value: n.transFatG,       unit: "g" },
    { label: "Cholestérol",      value: n.cholesterolMg,   unit: "mg" },
    // Minerals
    { label: "Sodium",           value: n.sodiumMg,        unit: "mg" },
    { label: "Potassium",        value: n.potassiumMg,     unit: "mg" },
    { label: "Calcium",          value: n.calciumMg,       unit: "mg", color: "#94a3b8" },
    { label: "Magnésium",        value: n.magneziumMg,     unit: "mg" },
    { label: "Fer",              value: n.ironMg,          unit: "mg", color: "#f87171" },
    { label: "Zinc",             value: n.zincMg,          unit: "mg" },
    // Vitamins
    { label: "Vit. C",           value: n.vitaminCMg,      unit: "mg", color: "#fb923c" },
    { label: "Vit. D",           value: n.vitaminDUg,      unit: "µg", color: "#fbbf24" },
    { label: "Vit. B12",         value: n.vitaminB12Ug,    unit: "µg" },
    { label: "Folate (B9)",      value: n.vitaminB9Ug,     unit: "µg" },
    { label: "Alcool",           value: n.alcoholG,        unit: "g" },
  ].filter((r) => r.value != null && r.value > 0);

  const hasMicros = microRows.length > 0;

  if (deleting) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="border-b last:border-b-0"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-2.5 py-2.5 cursor-pointer"
        onClick={() => hasMicros && setExpanded((x) => !x)}
      >
        {/* Food emoji */}
        <span className="text-[18px] flex-shrink-0 select-none">{foodEmoji(entry.name)}</span>

        {/* Food info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {entry.name}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {entry.servingLabel ?? `${entry.servingQty} ${entry.servingUnit}`}
            {entry.brand ? ` · ${entry.brand}` : ""}
          </p>
        </div>

        {/* Nutrition + actions */}
        <div className="text-right flex-shrink-0">
          <p className="text-[13px] font-semibold t-calories tabular-nums">
            {Math.round(n.calories)} kcal
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            P{Math.round(n.proteinG)} · G{Math.round(n.carbsG)} · L{Math.round(n.fatG)}
          </p>
        </div>

        {/* Expand arrow (only if micros exist) + delete */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasMicros && (
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              style={{ display: "inline-flex", color: "var(--text-muted)" }}
            >
              <CaretDown size={11} />
            </motion.span>
          )}
          {/* Source dot */}
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: SOURCE_DOT[entry.source] ?? "var(--text-muted)" }}
          />
          <button
            onClick={handleDelete}
            className="btn-icon w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Supprimer"
            style={{ color: "var(--text-muted)" }}
          >
            <Trash size={12} />
          </button>
        </div>
      </div>

      {/* Micro-nutrient panel */}
      <AnimatePresence initial={false}>
        {expanded && hasMicros && (
          <motion.div
            key="micros"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="pb-3 pl-8">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                {microRows.map(({ label, value, unit, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span className="text-[11px] font-medium tabular-nums"
                      style={{ color: color ?? "var(--text-secondary)" }}>
                      {formatMicro(value, unit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
