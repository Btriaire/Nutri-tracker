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
  { re: /poulet|dinde|volaille|pintade/i,               emoji: "🍗", g1: "#6b2d0a", g2: "#3d1505" },
  { re: /canard/i,                                       emoji: "🦆", g1: "#5c3a0a", g2: "#2e1c04" },
  // ── Viandes rouges ──
  { re: /bœuf|boeuf|steak|bifteck|entrecôte|veau/i,     emoji: "🥩", g1: "#5c1111", g2: "#330808" },
  { re: /porc|jambon|lard|bacon|saucisse|chorizo|salami|charcuterie/i,
                                                         emoji: "🥓", g1: "#5c1422", g2: "#2e0910" },
  { re: /agneau|mouton/i,                                emoji: "🍖", g1: "#5c1010", g2: "#2e0808" },
  // ── Poissons & fruits de mer ──
  { re: /saumon|thon|sardine|cabillaud|truite|dorade|merlu|bar|sole|tilapia|maquereau/i,
                                                         emoji: "🐟", g1: "#0c3d5c", g2: "#061d2e" },
  { re: /crevette|homard|crabe|moule|huître|coquille|calmar|seiche|fruit.de.mer/i,
                                                         emoji: "🦐", g1: "#0b3d45", g2: "#051e24" },
  // ── Œufs ──
  { re: /œuf|omelette|tortilla/i,                        emoji: "🥚", g1: "#5c4203", g2: "#2e2002" },
  // ── Laitages / fromages ──
  { re: /camembert|brie|roquefort|comté|gruyère|emmental|cheddar|gouda|fromage/i,
                                                         emoji: "🧀", g1: "#5c3d03", g2: "#2e1d01" },
  { re: /yaourt|yogurt/i,                                emoji: "🍶", g1: "#2d1e5c", g2: "#160e2e" },
  { re: /lait/i,                                         emoji: "🥛", g1: "#0f2b5c", g2: "#07152e" },
  { re: /crème|ricotta|mozzarella/i,                     emoji: "🫙", g1: "#5c4f03", g2: "#2e2701" },
  { re: /beurre/i,                                       emoji: "🧈", g1: "#5c4703", g2: "#2e2201" },
  // ── Céréales / féculents ──
  { re: /riz|paella/i,                                   emoji: "🍚", g1: "#4a3b03", g2: "#251d01" },
  { re: /pâte|spaghetti|tagliatelle|penne|fusilli|ravioli|gnocchi/i,
                                                         emoji: "🍝", g1: "#5c3d03", g2: "#2e1d01" },
  { re: /quinoa|boulgour|épeautre|seigle|avoine|céréale|flocon|muesli|granola/i,
                                                         emoji: "🌾", g1: "#4a2d03", g2: "#251601" },
  { re: /croissant/i,                                    emoji: "🥐", g1: "#5c3d03", g2: "#2e1d01" },
  { re: /pain|baguette|brioche|toast|tartine|bread/i,    emoji: "🍞", g1: "#4a2d03", g2: "#251601" },
  { re: /crêpe|galette|pancake/i,                        emoji: "🥞", g1: "#5c4203", g2: "#2e2002" },
  { re: /pomme de terre|frite|patate|purée/i,            emoji: "🥔", g1: "#4a2d03", g2: "#251601" },
  // ── Légumes ──
  { re: /avocat/i,                                       emoji: "🥑", g1: "#0f3d1a", g2: "#071e0c" },
  { re: /tomate/i,                                       emoji: "🍅", g1: "#5c1111", g2: "#2e0808" },
  { re: /maïs/i,                                         emoji: "🌽", g1: "#5c4203", g2: "#2e2002" },
  { re: /concombre/i,                                    emoji: "🥒", g1: "#0f3d1a", g2: "#071e0c" },
  { re: /carotte|céleri|brocoli|choufleur|épinard|courgette|poivron|aubergine|haricot vert|asperge/i,
                                                         emoji: "🥦", g1: "#0f3d1a", g2: "#071e0c" },
  { re: /salade|roquette|mâche/i,                        emoji: "🥗", g1: "#103d14", g2: "#071e0a" },
  // ── Fruits ──
  { re: /banane/i,                                       emoji: "🍌", g1: "#5c4a03", g2: "#2e2501" },
  { re: /fraise/i,                                       emoji: "🍓", g1: "#5c1422", g2: "#2e0910" },
  { re: /raisin/i,                                       emoji: "🍇", g1: "#2d0f5c", g2: "#16072e" },
  { re: /pomme/i,                                        emoji: "🍎", g1: "#5c1111", g2: "#2e0808" },
  { re: /orange|mandarine|clémentine/i,                  emoji: "🍊", g1: "#5c2503", g2: "#2e1201" },
  { re: /citron/i,                                       emoji: "🍋", g1: "#5c4a03", g2: "#2e2501" },
  { re: /cerise/i,                                       emoji: "🍒", g1: "#5c1422", g2: "#2e0910" },
  { re: /pêche|abricot|nectarine/i,                      emoji: "🍑", g1: "#5c2d03", g2: "#2e1601" },
  { re: /melon|pastèque/i,                               emoji: "🍉", g1: "#0f3d1a", g2: "#071e0c" },
  { re: /ananas/i,                                       emoji: "🍍", g1: "#5c4203", g2: "#2e2002" },
  { re: /mangue|papaye|kiwi|litchi/i,                    emoji: "🥭", g1: "#5c2503", g2: "#2e1201" },
  // ── Légumineuses ──
  { re: /lentille|pois chiche|haricot|fève/i,            emoji: "🫘", g1: "#4a2d03", g2: "#251601" },
  { re: /tofu|tempeh|seitan|protéine végétale/i,         emoji: "🌱", g1: "#0f3d1a", g2: "#071e0c" },
  // ── Oléagineux ──
  { re: /noix|amande|noisette|cacahuète|cajou|pistache|pécan/i,
                                                         emoji: "🥜", g1: "#4a2d03", g2: "#251601" },
  { re: /huile/i,                                        emoji: "🫙", g1: "#5c4a03", g2: "#2e2501" },
  // ── Sucreries ──
  { re: /chocolat/i,                                     emoji: "🍫", g1: "#1f0d47", g2: "#0f0623" },
  { re: /gâteau|tarte|cake|cookie|biscuit|madeleine|brownie|fondant/i,
                                                         emoji: "🍰", g1: "#4a0b2e", g2: "#250517" },
  { re: /glace|sorbet/i,                                 emoji: "🍦", g1: "#0b2e45", g2: "#051722" },
  { re: /miel/i,                                         emoji: "🍯", g1: "#5c3d03", g2: "#2e1d01" },
  { re: /sucre|confiture|jam/i,                          emoji: "🍬", g1: "#4a0b2e", g2: "#250517" },
  // ── Plats cuisinés ──
  { re: /pizza/i,                                        emoji: "🍕", g1: "#5c1111", g2: "#2e0808" },
  { re: /burger|hamburger/i,                             emoji: "🍔", g1: "#5c2503", g2: "#2e1201" },
  { re: /sandwich|wrap|burrito|tacos|fajita/i,           emoji: "🌮", g1: "#5c2503", g2: "#2e1201" },
  { re: /soupe|bouillon|velouté|potage/i,                emoji: "🍜", g1: "#5c3d03", g2: "#2e1d01" },
  { re: /lasagne|gratin|plat.cuisiné|plat préparé|plat composé/i,
                                                         emoji: "🫕", g1: "#5c2503", g2: "#2e1201" },
  // ── Boissons ──
  { re: /café/i,                                         emoji: "☕", g1: "#2e1503", g2: "#170a01" },
  { re: /thé/i,                                          emoji: "🍵", g1: "#0f3d1a", g2: "#071e0c" },
  { re: /jus|smoothie/i,                                 emoji: "🧃", g1: "#0f3d1a", g2: "#071e0c" },
  { re: /soda|cola|limonade/i,                           emoji: "🥤", g1: "#0c3d5c", g2: "#061d2e" },
  { re: /eau/i,                                          emoji: "💧", g1: "#0c3d5c", g2: "#061d2e" },
  { re: /vin/i,                                          emoji: "🍷", g1: "#3d0810", g2: "#1e0408" },
  { re: /bière/i,                                        emoji: "🍺", g1: "#5c3d03", g2: "#2e1d01" },
  // ── Condiments / épices ──
  { re: /sauce|ketchup|mayonnaise|moutarde|vinaigrette/i, emoji: "🫙", g1: "#5c2503", g2: "#2e1201" },
  { re: /épice|herbe|ail|oignon|échalote|poivre|sel|curry|curcuma|gingembre|coriandre/i,
                                                         emoji: "🌿", g1: "#0f3d1a", g2: "#071e0c" },
  { re: /algue/i,                                        emoji: "🫛", g1: "#0f3d1a", g2: "#071e0c" },
  // ── Snacks ──
  { re: /chips|crackers?|pop.corn/i,                     emoji: "🍿", g1: "#5c3d03", g2: "#2e1d01" },
  { re: /barre (de )?céréale|barre protéi/i,             emoji: "🍫", g1: "#1f0d47", g2: "#0f0623" },
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
