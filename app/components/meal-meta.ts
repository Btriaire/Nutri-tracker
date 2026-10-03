import { IconEggFried, IconSalad, IconMeat, IconApple } from "@tabler/icons-react";
import type { MealType } from "@/app/lib/types";

// Icone, nom et couleur de chaque repas : partages par le journal (MealSection) et la glycemie.
export const MEAL_META: Record<MealType, { fr: string; en: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; color2: string }> = {
  breakfast: { fr: "Petit-déjeuner", en: "Breakfast", Icon: IconEggFried, color: "var(--carbs)", color2: "var(--calories)" },
  lunch:     { fr: "Déjeuner",       en: "Lunch",     Icon: IconSalad,    color: "var(--calories)", color2: "var(--calories)" },
  dinner:    { fr: "Dîner",          en: "Dinner",    Icon: IconMeat,     color: "var(--danger)", color2: "#f43f5e" },
  snacks:    { fr: "Collations",     en: "Snacks",    Icon: IconApple,    color: "var(--fiber)", color2: "#22d3ee" },
};
