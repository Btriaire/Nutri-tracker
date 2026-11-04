import { EyeMetrics } from "@/app/lib/eye-metrics";

export interface FollowUpScan {
  date: string;
  metrics: {
    A: object;
    B: object;
    anisocoriaMm: number | null;
    quality: { score: number };
  };
}

export interface FollowUpRow {
  key: string;
  label: string;
  unit: string;
  latest: number | null;
  previous: number | null;
  deltaPrev: number | null;
  baseline: number | null;
  deltaBase: number | null;
  trend: "up" | "down" | "flat" | "na";
  points: number[];
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function valueOf(scan: FollowUpScan, key: string): number | null {
  if (key === "anisocoriaMm") {
    return scan.metrics.anisocoriaMm;
  } else {
    // Seules les valeurs numeriques comptent (champ absent des anciens scans = ignore)
    const side = (o: object): number | null => { const v = (o as Record<string, unknown>)[key]; return typeof v === "number" && Number.isFinite(v) ? v : null; };
    const validValues = [side(scan.metrics.A), side(scan.metrics.B)].filter((v): v is number => v !== null);
    return validValues.length > 0 ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length : null;
  }
}

export function eyeFollowUp(scans: FollowUpScan[]): { rows: FollowUpRow[]; count: number; sinceDays: number | null } {
  if (scans.length === 0) {
    return { rows: [], count: 0, sinceDays: null };
  }

  const count = scans.length;
  const sinceDays = count > 1 ? Math.round(dayNumber(scans[0].date) - dayNumber(scans[1].date)) : null;

  const metricsKeys: { key: string; label: string; unit: string }[] = [
    { key: "pupilMm", label: "Pupille", unit: "mm" },
    { key: "fenteRatio", label: "Ouverture de la fente", unit: "ratio" },
    { key: "mrd1Mm", label: "Paupière haute", unit: "mm" },
    { key: "rednessA", label: "Rougeur du blanc", unit: "a*" },
    { key: "scleraB", label: "Jaune du blanc", unit: "b*" },
    { key: "cernes", label: "Cernes", unit: "L*" },
    { key: "anisocoriaMm", label: "Anisocorie", unit: "mm" },
  ];

  const rows: FollowUpRow[] = metricsKeys.map(({ key, label, unit }) => {
    const values = scans.map((s) => valueOf(s, key));
    const latest = values[0] !== null ? parseFloat(values[0].toFixed(2)) : null;
    const previous = values.slice(1).find((v) => v !== null) !== undefined ? parseFloat(values.slice(1).find((v) => v !== null)!.toFixed(2)) : null;

    const baselineValues = values.slice(1, 6).filter((v): v is number => v !== null);
    let baseline: number | null = null;
    if (baselineValues.length > 0) {
      baselineValues.sort((a, b) => a - b);
      const medianIndex = Math.floor(baselineValues.length / 2);
      baseline = baselineValues.length % 2 === 0
        ? (baselineValues[medianIndex - 1] + baselineValues[medianIndex]) / 2
        : baselineValues[medianIndex];
      baseline = parseFloat(baseline.toFixed(2));
    }

    const points = values.slice(0, 12).filter((v): v is number => v !== null).reverse();

    const deltaPrev = latest !== null && previous !== null ? parseFloat((latest - previous).toFixed(2)) : null;
    const deltaBase = latest !== null && baseline !== null ? parseFloat((latest - baseline).toFixed(2)) : null;
    let trend: "up" | "down" | "flat" | "na" = "na";

    if (latest !== null && baseline !== null && deltaBase !== null) {
      if (Math.abs(deltaBase) < (baseline === 0 ? 0.05 : Math.abs(baseline) * 0.05)) {
        trend = "flat";
      } else {
        trend = deltaBase > 0 ? "up" : "down";
      }
    }

    return {
      key,
      label,
      unit,
      latest,
      previous,
      deltaPrev,
      baseline,
      deltaBase,
      trend,
      points,
    };
  });

  return { rows, count, sinceDays };
}
