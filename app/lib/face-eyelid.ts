type Pt = { x: number; y: number };

function mrd(axisFrom: Pt, axisTo: Pt, lid1: Pt, lid2: Pt, center: Pt, edge: Pt): number | null {
    const axis = { x: axisTo.x - axisFrom.x, y: axisTo.y - axisFrom.y };
    const axisLength = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
    if (axisLength < 1e-6) return null;

    const up = { x: axis.y / axisLength, y: -axis.x / axisLength };

    const line = { x: lid2.x - lid1.x, y: lid2.y - lid1.y };
    const lineLength = Math.sqrt(line.x * line.x + line.y * line.y);
    if (lineLength < 1e-6) return null;

    let n = { x: line.y / lineLength, y: -line.x / lineLength };
    if (n.x * up.x + n.y * up.y < 0) {
        n = { x: -n.x, y: -n.y };
    }

    const v = { x: lid1.x - center.x, y: lid1.y - center.y };

    const d = 2 * Math.sqrt((center.x - edge.x) * (center.x - edge.x) + (center.y - edge.y) * (center.y - edge.y));
    if (d < 1e-6) return null;

    return (v.x * n.x + v.y * n.y) / d;
}

// Mesure de type MRD1, relative a la reference personnelle, pas un diagnostic.
export function eyelids(P: Pt[]): { paupiere: number; asymPaupiere: number } | null {
    if (P.length < 478) return null;

    const A = mrd(P[33], P[133], P[159], P[158], P[468], P[469]);
    const B = mrd(P[362], P[263], P[386], P[385], P[473], P[474]);

    if (A === null || B === null) return null;

    return {
        paupiere: (A + B) / 2,
        asymPaupiere: Math.abs(A - B) * 100
    };
}
