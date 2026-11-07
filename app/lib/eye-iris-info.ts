// Ce que la litterature dit des traits de l'iris. References verifiees sur PubMed.
export interface IrisInfo { key: "cryptPct" | "furrowExtent" | "relief" | "radialRatio"; label: string; unit: string; meaning: string; science: string; refs: { label: string; url: string }[] }

const THICK = { label: "Sidhartha et al., Ophthalmology, 2014", url: "https://doi.org/10.1016/j.ophtha.2013.11.028" };
const ANGLE = { label: "Sidhartha et al., Invest Ophthalmol Vis Sci, 2014", url: "https://doi.org/10.1167/iovs.14-15402" };
const VOLUME = { label: "Chua et al., Ophthalmology, 2016", url: "https://doi.org/10.1016/j.ophtha.2016.06.034" };
const TWINS = { label: "Larsson et al., Twin Res, 2003", url: "https://doi.org/10.1375/136905203765693843" };
const DAUGMAN = { label: "Daugman, IEEE Trans CSVT, 2004 (méthode)", url: "https://doi.org/10.1109/TCSVT.2003.818350" };

export const IRIS_INFO: IrisInfo[] = [
  { key: "cryptPct", label: "Cryptes de Fuchs", unit: "% de la surface lue", meaning: "De petits creux sombres dans la couche superficielle de l'iris.", science: "Dans des études sur des yeux asiatiques, plus de cryptes allait avec un iris plus mince, un angle de l'œil plus large et une plus grande perte de volume quand la pupille se dilate. Leur fréquence est en partie héréditaire.", refs: [THICK, ANGLE, VOLUME, TWINS] },
  { key: "furrowExtent", label: "Sillons de contraction", unit: "% du tour lu", meaning: "Des arcs sombres près du bord de l'iris, qui suivent le cercle.", science: "Des sillons plus étendus allaient avec un iris plus épais en périphérie. Ce trait est fortement héréditaire.", refs: [THICK, TWINS] },
  { key: "relief", label: "Relief", unit: "L*", meaning: "L'intensité générale des détails de l'iris, une fois l'éclairage retiré.", science: "Mesure descriptive propre à cette application : aucune étude ne la relie à un état de santé.", refs: [DAUGMAN] },
  { key: "radialRatio", label: "Orientation des fibres", unit: "% radiaire", meaning: "La part des détails orientés du centre vers le bord, face à ceux qui suivent le cercle.", science: "Mesure descriptive propre à cette application : aucune étude ne la relie à un état de santé.", refs: [DAUGMAN] },
];

export const IRIS_IRIDOLOGY = { label: "Ernst, Forsch Komplementarmed, 1999", url: "https://doi.org/10.1159/000021201" };
