import { describe, it, expect } from "vitest";
import { faceAcquisition, facePose, faceFraming, ovalGeometry, fitStage, BestShot } from "@/app/lib/face-acquisition";

const VIDEO = { w: 720, h: 960 }, PHONE = { w: 390, h: 844 };
// Construit des points video normalises a partir d'une tete voulue a l'ecran (object-cover).
function head(view: { w: number; h: number }, sx: number, sTop: number, sChin: number, video = VIDEO) {
  const k = Math.max(view.w / video.w, view.h / video.h);
  const ox = (video.w * k - view.w) / 2, oy = (video.h * k - view.h) / 2;
  const nx = (x: number) => (x + ox) / (video.w * k), ny = (y: number) => (y + oy) / (video.h * k);
  const hh = sChin - sTop, half = hh * 0.36, foreTop = sTop + hh / 1.2 * 0.2, mid = (foreTop + sChin) / 2;
  const p = Array.from({ length: 478 }, () => ({ x: nx(sx), y: ny(mid) }));
  p[10] = { x: nx(sx), y: ny(foreTop) }; p[152] = { x: nx(sx), y: ny(sChin) };
  p[234] = { x: nx(sx - half), y: ny(mid) }; p[454] = { x: nx(sx + half), y: ny(mid) };
  return p;
}

describe("ovalGeometry", () => {
  it("l'ovale tient toujours dans l'ecran, y compris en paysage", () => {
    for (const v of [PHONE, { w: 1280, h: 720 }, { w: 320, h: 568 }]) {
      const o = ovalGeometry(v.w, v.h);
      expect(o.cy - o.ry).toBeGreaterThanOrEqual(0);
      expect(o.cy + o.ry).toBeLessThanOrEqual(v.h);
      expect(o.cx - o.rx).toBeGreaterThanOrEqual(0);
      expect(o.cx + o.rx).toBeLessThanOrEqual(v.w);
    }
  });
});

describe("faceFraming", () => {
  const o = ovalGeometry(PHONE.w, PHONE.h);
  it("tete bien placee dans l'ovale : remplissage correct et centre", () => {
    const f = faceFraming(head(PHONE, o.cx, o.cy - o.ry * 0.9, o.cy + o.ry * 0.9), VIDEO, PHONE);
    expect(f.fill).toBeCloseTo(0.9, 2);
    expect(Math.abs(f.dx)).toBeLessThan(0.01);
    expect(Math.abs(f.dy)).toBeLessThan(0.01);
    expect(f.inFrame).toBe(true);
  });
  it("visage coupe a l'ecran alors qu'il est entier dans la video : inFrame faux", () => {
    // Largeur 0,6 de la video : c'etait accepte avant, mais deborde de l'ecran du telephone.
    const f = faceFraming(head(PHONE, o.cx, 40, 800), VIDEO, PHONE);
    expect(f.inFrame).toBe(false);
  });
  it("menton hors ecran : inFrame faux", () => {
    expect(faceFraming(head(PHONE, o.cx, 500, 900), VIDEO, PHONE).inFrame).toBe(false);
  });
  it("marge pour le front : le haut de tete estime compte", () => {
    const top = head(PHONE, o.cx, -30, 400);
    expect(faceFraming(top, VIDEO, PHONE).inFrame).toBe(false);
  });
  it("marche quand la video est paysage et l'ecran portrait", () => {
    const v = { w: 1280, h: 720 };
    const f = faceFraming(head(PHONE, o.cx, o.cy - o.ry * 0.9, o.cy + o.ry * 0.9, v), v, PHONE);
    expect(f.fill).toBeCloseTo(0.9, 2);
    expect(f.inFrame).toBe(true);
  });
});

describe("faceAcquisition", () => {
  const good = { fill: 0.9, dx: 0, dy: 0, inFrame: true, yawDeg: 0, rollDeg: 0, motion: 0, sharp: 13, light: 130 };
  it("bonne prise : 100 sans probleme", () => {
    expect(faceAcquisition(good)).toEqual({ score: 100, issue: null });
  });
  it("hors cadre passe avant tout et bloque le score sous le seuil", () => {
    const a = faceAcquisition({ ...good, inFrame: false, fill: 1.3 });
    expect(a.issue).toBe("Visage coupé : éloigne-toi");
    expect(a.score).toBeLessThan(70);
  });
  it("trop pres, trop loin, decentre", () => {
    expect(faceAcquisition({ ...good, fill: 1.15 }).issue).toBe("Trop près : éloigne-toi");
    expect(faceAcquisition({ ...good, fill: 0.5 }).issue).toBe("Trop loin : rapproche-toi");
    expect(faceAcquisition({ ...good, dx: 0.5 }).issue).toBe("Centre ton visage dans l'ovale");
  });
  it("le score reste entre 0 et 100", () => {
    const a = faceAcquisition({ fill: 3, dx: 4, dy: 4, inFrame: false, yawDeg: 80, rollDeg: 80, motion: 2, sharp: 0, light: 0 });
    expect(a.score).toBeGreaterThanOrEqual(0);
    const b = faceAcquisition({ ...good, sharp: 500 });
    expect(b.score).toBeLessThanOrEqual(100);
  });
  it("autres problemes inchanges", () => {
    expect(faceAcquisition({ ...good, yawDeg: 25 }).issue).toBe("Regarde bien en face");
    expect(faceAcquisition({ ...good, rollDeg: 20 }).issue).toBe("Redresse la tête");
    expect(faceAcquisition({ ...good, motion: 0.05 }).issue).toContain("Bouge moins");
    expect(faceAcquisition({ ...good, sharp: 3 }).issue).toContain("floue");
    expect(faceAcquisition({ ...good, light: 20 }).issue).toContain("sombre");
  });
});

describe("facePose et BestShot", () => {
  it("visage de face : lacet et roulis nuls", () => {
    const p = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    p[234] = { x: 0.3, y: 0.5 }; p[454] = { x: 0.7, y: 0.5 }; p[33] = { x: 0.4, y: 0.4 }; p[263] = { x: 0.6, y: 0.4 };
    const f = facePose(p);
    expect(f.yawDeg).toBeCloseTo(0, 3); expect(f.rollDeg).toBeCloseTo(0, 3);
  });
  it("garde la meilleure photo au-dessus du seuil", () => {
    const b = new BestShot<string>(70);
    b.offer(60, "a"); b.offer(80, "b"); b.offer(75, "c");
    expect(b.best).toBe("b"); expect(b.count).toBe(2);
  });
});

describe("fitStage : plus besoin de reculer", () => {
  it("la video entiere tient dans l'ecran", () => {
    expect(fitStage(VIDEO, PHONE)).toEqual({ w: 390, h: 520 });
    expect(fitStage({ w: 1280, h: 720 }, { w: 1280, h: 800 })).toEqual({ w: 1280, h: 720 });
  });
  it("visage occupant 60 % de la largeur de la photo, a bout de bras : accepte sans message", () => {
    const stage = fitStage(VIDEO, PHONE), o = ovalGeometry(stage.w, stage.h);
    // Tete de 0,84 x hauteur / largeur : helper head() -> demi-largeur = 0,36 x hauteur de tete
    const hh = (0.6 * stage.w) / 0.72;
    const f = faceFraming(head(stage, o.cx, o.cy - hh / 2, o.cy + hh / 2), VIDEO, stage);
    expect(f.inFrame).toBe(true);
    const a = faceAcquisition({ ...f, yawDeg: 0, rollDeg: 0, motion: 0, sharp: 13, light: 130 });
    expect(a.issue).toBeNull();
    expect(a.score).toBeGreaterThanOrEqual(90);
  });
});
