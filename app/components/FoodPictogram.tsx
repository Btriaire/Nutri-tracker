"use client";

/**
 * FoodPictogram — pictogramme coloré par catégorie alimentaire.
 * Remplace les photos/emojis plats par des badges dégradés style iOS.
 */

// ─── Catalogue catégorie → { emoji, gradients, ombre } ────────────────────────

interface PicDef {
  re:    RegExp;
  emoji: string;
  g1:    string;   // gradient start
  g2:    string;   // gradient end
  glow?: string;   // couleur ombre (défaut = g1 + 40)
}

const MAP: PicDef[] = [
  // ── Volailles ──
  { re: /poulet|dinde|volaille|pintade/i,               emoji: "🍗", g1: "#f97316", g2: "#c2410c" },
  { re: /canard/i,                                       emoji: "🦆", g1: "#f59e0b", g2: "#b45309" },
  // ── Viandes rouges ──
  { re: /bœuf|boeuf|steak|bifteck|entrecôte|veau/i,     emoji: "🥩", g1: "#ef4444", g2: "#9f1239" },
  { re: /porc|jambon|lard|bacon|saucisse|chorizo|salami|charcuterie/i,
                                                         emoji: "🥓", g1: "#f43f5e", g2: "#be123c" },
  { re: /agneau|mouton/i,                                emoji: "🍖", g1: "#dc2626", g2: "#7f1d1d" },
  // ── Poissons & fruits de mer ──
  { re: /saumon|thon|sardine|cabillaud|truite|dorade|merlu|bar|sole|tilapia|maquereau/i,
                                                         emoji: "🐟", g1: "#0ea5e9", g2: "#0369a1" },
  { re: /crevette|homard|crabe|moule|huître|coquille|calmar|seiche|fruit.de.mer/i,
                                                         emoji: "🦐", g1: "#06b6d4", g2: "#0e7490" },
  // ── Œufs ──
  { re: /œuf|omelette|tortilla/i,                        emoji: "🥚", g1: "#fbbf24", g2: "#d97706" },
  // ── Laitages / fromages ──
  { re: /camembert|brie|roquefort|comté|gruyère|emmental|cheddar|gouda|fromage/i,
                                                         emoji: "🧀", g1: "#f59e0b", g2: "#b45309" },
  { re: /yaourt|yogurt/i,                                emoji: "🍶", g1: "#a78bfa", g2: "#7c3aed" },
  { re: /lait/i,                                         emoji: "🥛", g1: "#93c5fd", g2: "#3b82f6" },
  { re: /crème|ricotta|mozzarella/i,                     emoji: "🫙", g1: "#fde68a", g2: "#d97706" },
  { re: /beurre/i,                                       emoji: "🧈", g1: "#fbbf24", g2: "#ca8a04" },
  // ── Céréales / féculents ──
  { re: /riz|paella/i,                                   emoji: "🍚", g1: "#fde68a", g2: "#ca8a04" },
  { re: /pâte|spaghetti|tagliatelle|penne|fusilli|ravioli|gnocchi/i,
                                                         emoji: "🍝", g1: "#f59e0b", g2: "#b45309" },
  { re: /quinoa|boulgour|épeautre|seigle|avoine|céréale|flocon|muesli|granola/i,
                                                         emoji: "🌾", g1: "#d97706", g2: "#92400e" },
  { re: /croissant/i,                                    emoji: "🥐", g1: "#f59e0b", g2: "#d97706" },
  { re: /pain|baguette|brioche|toast|tartine|bread/i,    emoji: "🍞", g1: "#d97706", g2: "#92400e" },
  { re: /crêpe|galette|pancake/i,                        emoji: "🥞", g1: "#fbbf24", g2: "#d97706" },
  { re: /pomme de terre|frite|patate|purée/i,            emoji: "🥔", g1: "#d97706", g2: "#78350f" },
  // ── Légumes ──
  { re: /avocat/i,                                       emoji: "🥑", g1: "#4ade80", g2: "#15803d" },
  { re: /tomate/i,                                       emoji: "🍅", g1: "#ef4444", g2: "#b91c1c" },
  { re: /maïs/i,                                         emoji: "🌽", g1: "#fbbf24", g2: "#d97706" },
  { re: /concombre/i,                                    emoji: "🥒", g1: "#4ade80", g2: "#15803d" },
  { re: /carotte|céleri|brocoli|choufleur|épinard|courgette|poivron|aubergine|haricot vert|asperge/i,
                                                         emoji: "🥦", g1: "#22c55e", g2: "#15803d" },
  { re: /salade|roquette|mâche/i,                        emoji: "🥗", g1: "#4ade80", g2: "#16a34a" },
  // ── Fruits ──
  { re: /banane/i,                                       emoji: "🍌", g1: "#fbbf24", g2: "#ca8a04" },
  { re: /fraise/i,                                       emoji: "🍓", g1: "#f43f5e", g2: "#be123c" },
  { re: /raisin/i,                                       emoji: "🍇", g1: "#a855f7", g2: "#6d28d9" },
  { re: /pomme/i,                                        emoji: "🍎", g1: "#ef4444", g2: "#b91c1c" },
  { re: /orange|mandarine|clémentine/i,                  emoji: "🍊", g1: "#f97316", g2: "#c2410c" },
  { re: /citron/i,                                       emoji: "🍋", g1: "#fbbf24", g2: "#ca8a04" },
  { re: /cerise/i,                                       emoji: "🍒", g1: "#f43f5e", g2: "#9f1239" },
  { re: /pêche|abricot|nectarine/i,                      emoji: "🍑", g1: "#fb923c", g2: "#c2410c" },
  { re: /melon|pastèque/i,                               emoji: "🍉", g1: "#4ade80", g2: "#15803d" },
  { re: /ananas/i,                                       emoji: "🍍", g1: "#fbbf24", g2: "#d97706" },
  { re: /mangue|papaye|kiwi|litchi/i,                    emoji: "🥭", g1: "#f97316", g2: "#c2410c" },
  // ── Légumineuses ──
  { re: /lentille|pois chiche|haricot|fève/i,            emoji: "🫘", g1: "#d97706", g2: "#92400e" },
  { re: /tofu|tempeh|seitan|protéine végétale/i,         emoji: "🌱", g1: "#4ade80", g2: "#15803d" },
  // ── Oléagineux ──
  { re: /noix|amande|noisette|cacahuète|cajou|pistache|pécan/i,
                                                         emoji: "🥜", g1: "#d97706", g2: "#92400e" },
  { re: /huile/i,                                        emoji: "🫙", g1: "#fbbf24", g2: "#d97706" },
  // ── Sucreries ──
  { re: /chocolat/i,                                     emoji: "🍫", g1: "#7c3aed", g2: "#3b0764" },
  { re: /gâteau|tarte|cake|cookie|biscuit|madeleine|brownie|fondant/i,
                                                         emoji: "🍰", g1: "#f472b6", g2: "#be185d" },
  { re: /glace|sorbet/i,                                 emoji: "🍦", g1: "#06b6d4", g2: "#0284c7" },
  { re: /miel/i,                                         emoji: "🍯", g1: "#f59e0b", g2: "#d97706" },
  { re: /sucre|confiture|jam/i,                          emoji: "🍬", g1: "#f472b6", g2: "#ec4899" },
  // ── Plats cuisinés ──
  { re: /pizza/i,                                        emoji: "🍕", g1: "#ef4444", g2: "#991b1b" },
  { re: /burger|hamburger/i,                             emoji: "🍔", g1: "#ea580c", g2: "#7c2d12" },
  { re: /sandwich|wrap|burrito|tacos|fajita/i,           emoji: "🌮", g1: "#f97316", g2: "#c2410c" },
  { re: /soupe|bouillon|velouté|potage/i,                emoji: "🍜", g1: "#f59e0b", g2: "#b45309" },
  { re: /lasagne|gratin|plat.cuisiné|plat préparé|plat composé/i,
                                                         emoji: "🫕", g1: "#f97316", g2: "#9a3412" },
  // ── Boissons ──
  { re: /café/i,                                         emoji: "☕", g1: "#92400e", g2: "#451a03" },
  { re: /thé/i,                                          emoji: "🍵", g1: "#4ade80", g2: "#15803d" },
  { re: /jus|smoothie/i,                                 emoji: "🧃", g1: "#22c55e", g2: "#15803d" },
  { re: /soda|cola|limonade/i,                           emoji: "🥤", g1: "#0ea5e9", g2: "#0284c7" },
  { re: /eau/i,                                          emoji: "💧", g1: "#38bdf8", g2: "#0369a1" },
  { re: /vin/i,                                          emoji: "🍷", g1: "#9f1239", g2: "#4c0519" },
  { re: /bière/i,                                        emoji: "🍺", g1: "#f59e0b", g2: "#b45309" },
  // ── Condiments / épices ──
  { re: /sauce|ketchup|mayonnaise|moutarde|vinaigrette/i, emoji: "🫙", g1: "#f97316", g2: "#c2410c" },
  { re: /épice|herbe|ail|oignon|échalote|poivre|sel|curry|curcuma|gingembre|coriandre/i,
                                                         emoji: "🌿", g1: "#4ade80", g2: "#15803d" },
  { re: /algue/i,                                        emoji: "🫛", g1: "#4ade80", g2: "#166534" },
  // ── Snacks ──
  { re: /chips|crackers?|pop.corn/i,                     emoji: "🍿", g1: "#f59e0b", g2: "#d97706" },
  { re: /barre (de )?céréale|barre protéi/i,             emoji: "🍫", g1: "#7c3aed", g2: "#4c1d95" },
];

// ─── Lookup ────────────────────────────────────────────────────────────────────

const DEFAULT_PIC: Omit<PicDef, "re"> = {
  emoji: "🍽️", g1: "#6366f1", g2: "#4338ca",
};

export function getFoodPic(name: string, category?: string): Omit<PicDef, "re"> {
  const text = `${name} ${category ?? ""}`;
  for (const item of MAP) {
    if (item.re.test(text)) return item;
  }
  return DEFAULT_PIC;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  name:      string;
  category?: string;
  size?:     number;   // px, default 44
  className?: string;
}

export default function FoodPictogram({ name, category, size = 44, className }: Props) {
  const { emoji, g1, g2 } = getFoodPic(name, category);
  const radius = Math.round(size * 0.27); // ~12px for size=44
  const emojiPx = Math.round(size * 0.50);

  return (
    <div
      className={className}
      style={{
        width:        size,
        height:       size,
        minWidth:     size,
        borderRadius: radius,
        background:   `linear-gradient(145deg, ${g1} 0%, ${g2} 100%)`,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        fontSize:     emojiPx,
        lineHeight:   1,
        position:     "relative",
        overflow:     "hidden",
        boxShadow:    `0 3px 10px ${g1}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
        flexShrink:   0,
      }}
    >
      {/* Glossy top highlight */}
      <div
        aria-hidden="true"
        style={{
          position:     "absolute",
          top: 0, left: 0, right: 0,
          height:       "48%",
          background:   "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 100%)",
          borderRadius: `${radius}px ${radius}px 60% 60%`,
        }}
      />
      {/* Subtle bottom reflection */}
      <div
        aria-hidden="true"
        style={{
          position:  "absolute",
          bottom: 0, left: 0, right: 0,
          height:    "30%",
          background: "linear-gradient(0deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 100%)",
        }}
      />
      <span style={{ position: "relative", zIndex: 1, userSelect: "none" }}>
        {emoji}
      </span>
    </div>
  );
}
