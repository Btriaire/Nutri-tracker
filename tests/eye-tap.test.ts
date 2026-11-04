import { describe, it, expect } from "vitest";
import { tapToImage, TapView } from "../app/lib/eye-tap";

function forward(imgPoint: { x: number; y: number }, v: TapView): { x: number; y: number } {
  const s = Math.max(v.cw / v.vw, v.ch / v.vh);
  const dw = v.vw * s;
  const dh = v.vh * s;
  const ox = (v.cw - dw) * v.posX;
  const oy = (v.ch - dh) * v.posY;
  const O = { x: v.originX * v.cw, y: v.originY * v.ch };
  const zoomX = v.mirror ? -v.zoom : v.zoom;
  const zoomY = v.zoom;
  const P = {
    x: ox + imgPoint.x * s,
    y: oy + imgPoint.y * s,
  };
  return {
    x: O.x + (P.x - O.x) * zoomX,
    y: O.y + (P.y - O.y) * zoomY,
  };
}

describe("tapToImage", () => {
  const views: TapView[] = [
    { cw: 320, ch: 200, vw: 1280, vh: 720, zoom: 1, originX: 0.5, originY: 0.42, posX: 0.5, posY: 0.38, mirror: false },
    { cw: 320, ch: 200, vw: 1280, vh: 720, zoom: 1, originX: 0.5, originY: 0.42, posX: 0.5, posY: 0.38, mirror: true },
    { cw: 320, ch: 200, vw: 1280, vh: 720, zoom: 2, originX: 0.31, originY: 0.42, posX: 0.5, posY: 0.38, mirror: true },
    { cw: 320, ch: 200, vw: 1280, vh: 720, zoom: 2, originX: 0.69, originY: 0.42, posX: 0.5, posY: 0.38, mirror: true },
  ];

  const imgPoints = [
    { x: 640, y: 360 },
    { x: 100, y: 50 },
    { x: 1200, y: 700 },
    { x: 300, y: 400 },
  ];

  views.forEach((view, i) => {
    it(`should correctly transform tap to image for view ${i + 1}`, () => {
      imgPoints.forEach((imgPoint) => {
        const tap = forward(imgPoint, view);
        const result = tapToImage(tap, view);
        expect(result.x).toBeCloseTo(imgPoint.x, 6);
        expect(result.y).toBeCloseTo(imgPoint.y, 6);
      });
    });
  });

  it("should correctly transform tap to image for view without zoom or mirror", () => {
    const view: TapView = { cw: 100, ch: 50, vw: 100, vh: 50, zoom: 1, originX: 0.5, originY: 0.5, posX: 0.5, posY: 0.5, mirror: false };
    const tap = { x: 10, y: 20 };
    const result = tapToImage(tap, view);
    expect(result.x).toBeCloseTo(10, 6);
    expect(result.y).toBeCloseTo(20, 6);
  });

  it("should correctly transform tap to image for view with mirror only", () => {
    const view: TapView = { cw: 100, ch: 50, vw: 100, vh: 50, zoom: 1, originX: 0.5, originY: 0.5, posX: 0.5, posY: 0.5, mirror: true };
    const tap = { x: 10, y: 20 };
    const result = tapToImage(tap, view);
    expect(result.x).toBeCloseTo(90, 6);
    expect(result.y).toBeCloseTo(20, 6);
  });
});
