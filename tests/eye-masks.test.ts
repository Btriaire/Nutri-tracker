import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EyeStructureMasks, { aperturePath } from "../app/components/EyeStructureMasks";

const side = { pupilMm: 4, mrd1Mm: 4, mrd2Mm: 5, fissureWidthMm: 26 };
const PX = 320 / (3 * 11.7);
const html = (s: object) => renderToStaticMarkup(createElement("svg", null, createElement(EyeStructureMasks, { side: s as typeof side })));

describe("aperturePath", () => {
  it("relie les deux coins par deux courbes, controles au double de la hauteur", () => {
    const p = aperturePath(4, 5, 26);
    const x0 = 160 - 13 * PX, x1 = 160 + 13 * PX;
    expect(p).toBe(`M ${x0.toFixed(1)} 160 Q 160 ${(160 - 8 * PX).toFixed(1)} ${x1.toFixed(1)} 160 Q 160 ${(160 + 10 * PX).toFixed(1)} ${x0.toFixed(1)} 160 Z`);
  });
});
describe("EyeStructureMasks", () => {
  it("dessine blanc, iris et pupille, limites a l'ouverture", () => {
    const h = html(side);
    expect(h).toContain("<clipPath");
    expect(h).toContain('data-structure="sclera"');
    expect(h).toContain('data-structure="iris"');
    expect(h).toContain('data-structure="pupil"');
    expect(h).toContain("clip-path=\"url(#");
    expect(h).toContain('fill-rule="evenodd"');
    expect(h).toContain(`r="${(2 * PX).toFixed(1)}"`);
  });
  it("sans pupille mesuree, pas de pupille", () => { expect(html({ ...side, pupilMm: null })).not.toContain('data-structure="pupil"'); });
  it("sans largeur de fente, ne dessine rien", () => { expect(html({ ...side, fissureWidthMm: undefined })).not.toContain("data-structure"); });
});
