import { describe, it, expect } from "vitest";
import { eyelids } from "@/app/lib/face-eyelid";

function pts(o: { droopB?: number; scale?: number; rot?: number } = {}) {
  const p = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  const set = (i: number, x: number, y: number) => { p[i] = { x, y }; };
  // Oeil A : iris rayon 15, centre (100,100), paupiere superieure 15 au-dessus du centre
  set(33, 60, 100); set(133, 140, 100); set(159, 110, 85); set(158, 90, 85); set(468, 100, 100); set(469, 115, 100);
  // Oeil B
  const d = o.droopB ?? 0;
  set(263, 340, 100); set(362, 260, 100); set(386, 310, 85 + d); set(385, 290, 85 + d); set(473, 300, 100); set(474, 315, 100);
  const s = o.scale ?? 1, a = o.rot ?? 0;
  return p.map(({ x, y }) => ({ x: s * (x * Math.cos(a) - y * Math.sin(a)), y: s * (x * Math.sin(a) + y * Math.cos(a)) }));
}

describe("eyelids", () => {
  it("mesure la paupiere superieure en diametres d'iris", () => {
    const r = eyelids(pts())!;
    expect(r.paupiere).toBeCloseTo(0.5, 3);
    expect(r.asymPaupiere).toBeCloseTo(0, 3);
  });
  it("ne depend ni de la distance ni de l'inclinaison de la tete", () => {
    const r = eyelids(pts({ scale: 3, rot: 0.3, droopB: 6 }))!;
    const ref = eyelids(pts({ droopB: 6 }))!;
    expect(r.paupiere).toBeCloseTo(ref.paupiere, 3);
    expect(r.asymPaupiere).toBeCloseTo(ref.asymPaupiere, 3);
  });
  it("une paupiere tombante baisse la mesure et cree une asymetrie", () => {
    const r = eyelids(pts({ droopB: 6 }))!;
    expect(r.paupiere).toBeCloseTo(0.4, 3);
    expect(r.asymPaupiere).toBeCloseTo(20, 3);
  });
  it("paupiere sous le centre de l'iris : valeur negative", () => {
    const r = eyelids(pts({ droopB: 21 }))!;
    expect(r.asymPaupiere).toBeCloseTo(70, 3);
    expect(r.paupiere).toBeCloseTo(0.15, 3);
  });
  it("null sans les points d'iris ou si l'iris est degenere", () => {
    expect(eyelids(pts().slice(0, 468))).toBeNull();
    const p = pts(); p[469] = p[468];
    expect(eyelids(p)).toBeNull();
  });
});
