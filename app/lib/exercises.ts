// ─── Bibliothèque d'exercices de musculation (FR) ──────────────────────────────
//
// Liste curée (~50 exercices) à partir de free-exercise-db (domaine public,
// github.com/yuhonas/free-exercise-db), traduite et adaptée en français.
//
// Les noms de muscles correspondent EXACTEMENT à ceux attendus par
// react-body-highlighter (<Model>), pour pouvoir surligner le corps en SVG.

/** Muscles reconnus par react-body-highlighter. */
export type Muscle =
  | "trapezius" | "upper-back" | "lower-back" | "chest"
  | "biceps" | "triceps" | "forearm"
  | "back-deltoids" | "front-deltoids"
  | "abs" | "obliques"
  | "adductor" | "hamstring" | "quadriceps" | "abductors"
  | "calves" | "gluteal" | "neck";

export type Equipment =
  | "barre" | "halteres" | "machine" | "poulie"
  | "poids-du-corps" | "kettlebell" | "elastique";

export type MuscleGroup =
  | "pectoraux" | "dos" | "epaules" | "biceps" | "triceps"
  | "avant-bras" | "jambes" | "fessiers" | "mollets" | "abdos";

export interface Exercise {
  id:        string;
  name:      string;          // FR
  group:     MuscleGroup;     // groupe principal (pour le filtre/onglet)
  primary:   Muscle;          // muscle principal (surligné fort)
  secondary: Muscle[];        // muscles secondaires (surlignés léger)
  equipment: Equipment;
}

// ─── Libellés FR ────────────────────────────────────────────────────────────────

export const MUSCLE_LABELS: Record<Muscle, string> = {
  "trapezius":      "Trapèzes",
  "upper-back":     "Haut du dos",
  "lower-back":     "Bas du dos",
  "chest":          "Pectoraux",
  "biceps":         "Biceps",
  "triceps":        "Triceps",
  "forearm":        "Avant-bras",
  "back-deltoids":  "Épaules (arrière)",
  "front-deltoids": "Épaules (avant)",
  "abs":            "Abdominaux",
  "obliques":       "Obliques",
  "adductor":       "Adducteurs",
  "hamstring":      "Ischio-jambiers",
  "quadriceps":     "Quadriceps",
  "abductors":      "Abducteurs",
  "calves":         "Mollets",
  "gluteal":        "Fessiers",
  "neck":           "Cou",
};

export const GROUP_LABELS: Record<MuscleGroup, string> = {
  pectoraux:   "Pectoraux",
  dos:         "Dos",
  epaules:     "Épaules",
  biceps:      "Biceps",
  triceps:     "Triceps",
  "avant-bras": "Avant-bras",
  jambes:      "Jambes",
  fessiers:    "Fessiers",
  mollets:     "Mollets",
  abdos:       "Abdominaux",
};

export const GROUP_ORDER: MuscleGroup[] = [
  "pectoraux", "dos", "epaules", "biceps", "triceps",
  "avant-bras", "jambes", "fessiers", "mollets", "abdos",
];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barre:           "Barre",
  halteres:        "Haltères",
  machine:         "Machine",
  poulie:          "Poulie",
  "poids-du-corps": "Poids du corps",
  kettlebell:      "Kettlebell",
  elastique:       "Élastique",
};

// ─── Catalogue ──────────────────────────────────────────────────────────────────

export const EXERCISES: Exercise[] = [
  // ── Pectoraux ──────────────────────────────────────────────────────────────
  { id: "developpe-couche-barre",   name: "Développé couché (barre)",      group: "pectoraux", primary: "chest", secondary: ["triceps", "front-deltoids"], equipment: "barre" },
  { id: "developpe-couche-halteres", name: "Développé couché (haltères)",  group: "pectoraux", primary: "chest", secondary: ["triceps", "front-deltoids"], equipment: "halteres" },
  { id: "developpe-incline",        name: "Développé incliné",             group: "pectoraux", primary: "chest", secondary: ["front-deltoids", "triceps"], equipment: "barre" },
  { id: "ecarte-halteres",          name: "Écarté haltères",               group: "pectoraux", primary: "chest", secondary: ["front-deltoids"], equipment: "halteres" },
  { id: "pec-deck",                 name: "Pec deck",                      group: "pectoraux", primary: "chest", secondary: [], equipment: "machine" },
  { id: "ecarte-poulie",            name: "Écarté à la poulie",            group: "pectoraux", primary: "chest", secondary: ["front-deltoids"], equipment: "poulie" },
  { id: "pompes",                   name: "Pompes",                        group: "pectoraux", primary: "chest", secondary: ["triceps", "front-deltoids"], equipment: "poids-du-corps" },
  { id: "dips",                     name: "Dips",                          group: "pectoraux", primary: "chest", secondary: ["triceps", "front-deltoids"], equipment: "poids-du-corps" },

  // ── Dos ────────────────────────────────────────────────────────────────────
  { id: "tractions",                name: "Tractions",                     group: "dos", primary: "upper-back", secondary: ["biceps", "forearm"], equipment: "poids-du-corps" },
  { id: "tirage-vertical",          name: "Tirage vertical",               group: "dos", primary: "upper-back", secondary: ["biceps"], equipment: "poulie" },
  { id: "rowing-barre",             name: "Rowing barre",                  group: "dos", primary: "upper-back", secondary: ["biceps", "lower-back"], equipment: "barre" },
  { id: "rowing-haltere",          name: "Rowing haltère",                group: "dos", primary: "upper-back", secondary: ["biceps"], equipment: "halteres" },
  { id: "tirage-horizontal",        name: "Tirage horizontal",             group: "dos", primary: "upper-back", secondary: ["biceps"], equipment: "poulie" },
  { id: "souleve-de-terre",         name: "Soulevé de terre",              group: "dos", primary: "lower-back", secondary: ["gluteal", "hamstring", "trapezius"], equipment: "barre" },
  { id: "shrugs",                   name: "Shrugs (trapèzes)",             group: "dos", primary: "trapezius", secondary: ["forearm"], equipment: "halteres" },
  { id: "extension-lombaire",       name: "Extension lombaire",            group: "dos", primary: "lower-back", secondary: ["gluteal"], equipment: "poids-du-corps" },

  // ── Épaules ────────────────────────────────────────────────────────────────
  { id: "developpe-militaire",      name: "Développé militaire",           group: "epaules", primary: "front-deltoids", secondary: ["triceps", "trapezius"], equipment: "barre" },
  { id: "developpe-epaules-halteres", name: "Développé épaules haltères",  group: "epaules", primary: "front-deltoids", secondary: ["triceps"], equipment: "halteres" },
  { id: "elevations-laterales",     name: "Élévations latérales",          group: "epaules", primary: "front-deltoids", secondary: ["back-deltoids"], equipment: "halteres" },
  { id: "elevations-frontales",     name: "Élévations frontales",          group: "epaules", primary: "front-deltoids", secondary: [], equipment: "halteres" },
  { id: "oiseau",                   name: "Oiseau (deltoïde postérieur)",  group: "epaules", primary: "back-deltoids", secondary: ["trapezius"], equipment: "halteres" },
  { id: "face-pull",                name: "Face pull",                     group: "epaules", primary: "back-deltoids", secondary: ["trapezius"], equipment: "poulie" },

  // ── Biceps ─────────────────────────────────────────────────────────────────
  { id: "curl-barre",               name: "Curl barre",                    group: "biceps", primary: "biceps", secondary: ["forearm"], equipment: "barre" },
  { id: "curl-halteres",            name: "Curl haltères",                 group: "biceps", primary: "biceps", secondary: ["forearm"], equipment: "halteres" },
  { id: "curl-marteau",             name: "Curl marteau",                  group: "biceps", primary: "biceps", secondary: ["forearm"], equipment: "halteres" },
  { id: "curl-pupitre",             name: "Curl pupitre",                  group: "biceps", primary: "biceps", secondary: [], equipment: "barre" },
  { id: "curl-poulie",             name: "Curl à la poulie",              group: "biceps", primary: "biceps", secondary: [], equipment: "poulie" },

  // ── Triceps ────────────────────────────────────────────────────────────────
  { id: "extension-triceps-poulie", name: "Extension triceps poulie",      group: "triceps", primary: "triceps", secondary: [], equipment: "poulie" },
  { id: "barre-au-front",           name: "Barre au front",                group: "triceps", primary: "triceps", secondary: [], equipment: "barre" },
  { id: "extension-nuque",          name: "Extension nuque haltère",       group: "triceps", primary: "triceps", secondary: [], equipment: "halteres" },
  { id: "dips-banc",                name: "Dips sur banc",                 group: "triceps", primary: "triceps", secondary: ["chest"], equipment: "poids-du-corps" },
  { id: "kickback",                 name: "Kickback",                      group: "triceps", primary: "triceps", secondary: [], equipment: "halteres" },

  // ── Avant-bras ─────────────────────────────────────────────────────────────
  { id: "curl-poignets",            name: "Curl poignets",                 group: "avant-bras", primary: "forearm", secondary: [], equipment: "halteres" },

  // ── Jambes ─────────────────────────────────────────────────────────────────
  { id: "squat",                    name: "Squat",                         group: "jambes", primary: "quadriceps", secondary: ["gluteal", "hamstring"], equipment: "barre" },
  { id: "presse-cuisses",           name: "Presse à cuisses",              group: "jambes", primary: "quadriceps", secondary: ["gluteal"], equipment: "machine" },
  { id: "leg-extension",            name: "Leg extension",                 group: "jambes", primary: "quadriceps", secondary: [], equipment: "machine" },
  { id: "fentes",                   name: "Fentes",                        group: "jambes", primary: "quadriceps", secondary: ["gluteal", "hamstring"], equipment: "halteres" },
  { id: "squat-bulgare",            name: "Squat bulgare",                 group: "jambes", primary: "quadriceps", secondary: ["gluteal"], equipment: "halteres" },
  { id: "hack-squat",               name: "Hack squat",                    group: "jambes", primary: "quadriceps", secondary: ["gluteal"], equipment: "machine" },
  { id: "leg-curl",                 name: "Leg curl",                      group: "jambes", primary: "hamstring", secondary: [], equipment: "machine" },
  { id: "souleve-terre-jambes-tendues", name: "Soulevé de terre jambes tendues", group: "jambes", primary: "hamstring", secondary: ["gluteal", "lower-back"], equipment: "barre" },
  { id: "adduction-machine",        name: "Adduction (machine)",           group: "jambes", primary: "adductor", secondary: [], equipment: "machine" },

  // ── Fessiers ───────────────────────────────────────────────────────────────
  { id: "hip-thrust",               name: "Hip thrust",                    group: "fessiers", primary: "gluteal", secondary: ["hamstring"], equipment: "barre" },
  { id: "abduction-machine",        name: "Abduction (machine)",           group: "fessiers", primary: "abductors", secondary: ["gluteal"], equipment: "machine" },

  // ── Mollets ────────────────────────────────────────────────────────────────
  { id: "mollets-debout",           name: "Mollets debout",                group: "mollets", primary: "calves", secondary: [], equipment: "machine" },
  { id: "mollets-assis",            name: "Mollets assis",                 group: "mollets", primary: "calves", secondary: [], equipment: "machine" },

  // ── Abdominaux ─────────────────────────────────────────────────────────────
  { id: "crunch",                   name: "Crunch",                        group: "abdos", primary: "abs", secondary: [], equipment: "poids-du-corps" },
  { id: "releve-jambes",            name: "Relevé de jambes",              group: "abdos", primary: "abs", secondary: ["obliques"], equipment: "poids-du-corps" },
  { id: "gainage",                  name: "Gainage (planche)",             group: "abdos", primary: "abs", secondary: ["obliques"], equipment: "poids-du-corps" },
  { id: "russian-twist",            name: "Russian twist",                 group: "abdos", primary: "obliques", secondary: ["abs"], equipment: "poids-du-corps" },
  { id: "roulette-abdos",           name: "Roulette abdominale",           group: "abdos", primary: "abs", secondary: ["obliques"], equipment: "poids-du-corps" },
];

export const EXERCISE_BY_ID: Record<string, Exercise> =
  Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function exercisesByGroup(group: MuscleGroup): Exercise[] {
  return EXERCISES.filter((e) => e.group === group);
}

/** All muscles worked by an exercise (primary + secondary). */
export function exerciseMuscles(ex: Exercise): Muscle[] {
  return [ex.primary, ...ex.secondary];
}
