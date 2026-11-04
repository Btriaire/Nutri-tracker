export interface TapView {
  cw: number;
  ch: number;
  vw: number;
  vh: number;
  zoom: number;
  originX: number;
  originY: number;
  posX: number;
  posY: number;
  mirror: boolean;
}

export function tapToImage(tap: { x: number; y: number }, v: TapView): { x: number; y: number } {
  const s = Math.max(v.cw / v.vw, v.ch / v.vh);
  const dw = v.vw * s;
  const dh = v.vh * s;
  const ox = (v.cw - dw) * v.posX;
  const oy = (v.ch - dh) * v.posY;
  const O = { x: v.originX * v.cw, y: v.originY * v.ch };
  const zoomX = v.mirror ? -v.zoom : v.zoom;
  const zoomY = v.zoom;
  const P = {
    x: O.x + (tap.x - O.x) / zoomX,
    y: O.y + (tap.y - O.y) / zoomY,
  };
  return {
    x: (P.x - ox) / s,
    y: (P.y - oy) / s,
  };
}
