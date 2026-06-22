"use client";

import Model, { type IExerciseData, type Muscle as RBHMuscle } from "react-body-highlighter";
import type { Muscle } from "@/app/lib/exercises";

interface Props {
  primary?:   Muscle[];                 // surlignés fort
  secondary?: Muscle[];                 // surlignés léger
  accent?:    string;                   // couleur forte (défaut bleu activité)
  onMuscleClick?: (muscle: string) => void;
  size?:      number;                   // hauteur en px de chaque corps
  showBack?:  boolean;                  // afficher la vue dos (défaut true)
}

/**
 * Carte corporelle SVG (react-body-highlighter) — vues face + dos côte à côte.
 * Les muscles primaires sont surlignés fort, les secondaires en teinte douce.
 */
export default function MuscleBodyMap({
  primary = [],
  secondary = [],
  accent = "#38bdf8",
  onMuscleClick,
  size = 220,
  showBack = true,
}: Props) {
  // frequency 2 = primaire (couleur forte), 1 = secondaire (couleur douce)
  const data: IExerciseData[] = [];
  if (secondary.length) data.push({ name: "secondaire", muscles: secondary as unknown as RBHMuscle[], frequency: 1 });
  if (primary.length)   data.push({ name: "primaire",   muscles: primary   as unknown as RBHMuscle[], frequency: 2 });

  const handleClick: React.ComponentProps<typeof Model>["onClick"] = onMuscleClick
    ? ({ muscle }) => onMuscleClick(muscle)
    : undefined;

  const common = {
    data,
    bodyColor: "#2a3340",
    highlightedColors: [`${accent}66`, accent], // [secondaire (alpha), primaire]
    onClick: handleClick,
    style: { width: "auto", height: size, cursor: onMuscleClick ? "pointer" : "default" },
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
      <Model {...common} type="anterior" />
      {showBack && <Model {...common} type="posterior" />}
    </div>
  );
}
