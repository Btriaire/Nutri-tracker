// lien entre les mesures du visage et le mode de vie, sur les propres donnees de la personne ; correlation n'est pas causalite

import { METRICS, type FaceMetrics, type MetricKey } from "./face-metrics";

export interface DayFactors { sleepH?: number | null; alcoholG?: number | null; saltG?: number | null; weightKg?: number | null }
export type FactorKey = "sleepH" | "alcoholG" | "saltG" | "weightKg";
export interface LifestyleLink { metric: MetricKey; factor: FactorKey; n: number; rho: number; p: number; status: "confirmé" | "à surveiller"; text: string }

export function faceLifestyle(scans: { date: string; metrics: FaceMetrics }[], days: Record<string, DayFactors>): { tested: number; links: LifestyleLink[] } {
  const keptScans = scans.filter(scan => scan.metrics.quality.score >= 60);
  const metricsToTest: MetricKey[] = ["volumeBasVisage", "ouvertureYeux", "cernes", "paupiere", "rougeur", "levres"];
  const factorKeys: FactorKey[] = ["sleepH", "alcoholG", "saltG", "weightKg"];
  const links: LifestyleLink[] = [];
  let tested = 0;

  const getMedian = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  };

  const getFactorValue = (date: string, factor: FactorKey): number | null => {
    if (factor === "sleepH") {
      const prevDate = new Date(date);
      prevDate.setUTCDate(prevDate.getUTCDate() - 1);
      const prevDateStr = prevDate.toISOString().slice(0, 10);
      const value = days[prevDateStr]?.sleepH;
      return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
    } else if (factor === "weightKg") {
      const weightValues: number[] = [];
      for (let i = -14; i <= 14; i++) {
        const currentDate = new Date(date);
        currentDate.setUTCDate(currentDate.getUTCDate() + i);
        const currentDateStr = currentDate.toISOString().slice(0, 10);
        const weight = days[currentDateStr]?.weightKg;
        if (weight !== null && weight !== undefined && Number.isFinite(weight)) {
          weightValues.push(weight);
        }
      }
      if (weightValues.length >= 3) {
        const median = getMedian(weightValues);
        const weight = days[date]?.weightKg ?? days[new Date(Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth(), new Date(date).getUTCDate() - 1)).toISOString().slice(0, 10)]?.weightKg ?? days[new Date(Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth(), new Date(date).getUTCDate() + 1)).toISOString().slice(0, 10)]?.weightKg;
        return weight !== null && weight !== undefined && Number.isFinite(weight) ? weight - median : null;
      }
      return null;
    } else {
      const prevDate = new Date(date);
      prevDate.setUTCDate(prevDate.getUTCDate() - 1);
      const prevDateStr = prevDate.toISOString().slice(0, 10);
      const value = days[prevDateStr]?.[factor];
      return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
    }
  };

  const calculateSpearmanRho = (x: number[], y: number[]): number => {
    const rank = (arr: number[]): number[] => {
      const sorted = [...arr].sort((a, b) => a - b);
      return arr.map(v => sorted.indexOf(v) + 1 + (sorted.lastIndexOf(v) - sorted.indexOf(v)) / 2);
    };
    const xRank = rank(x);
    const yRank = rank(y);
    const n = x.length;
    const sumX = xRank.reduce((a, b) => a + b, 0);
    const sumY = yRank.reduce((a, b) => a + b, 0);
    const sumXY = xRank.reduce((sum, val, i) => sum + val * yRank[i], 0);
    const sumX2 = xRank.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = yRank.reduce((sum, val) => sum + val * val, 0);
    const numerator = sumXY - sumX * sumY / n;
    const denominatorX = Math.sqrt(sumX2 - sumX * sumX / n);
    const denominatorY = Math.sqrt(sumY2 - sumY * sumY / n);
    if (denominatorX === 0 || denominatorY === 0) return 0;
    return numerator / (denominatorX * denominatorY);
  };

  const calculatePValue = (rho: number, n: number): number => {
    const z = Math.atanh(Math.max(-0.999, Math.min(0.999, rho))) * Math.sqrt(n - 3);
    const erf = (x: number): number => {
      const a1 =  0.254829592;
      const a2 = -0.284496736;
      const a3 =  1.421413741;
      const a4 = -1.453152027;
      const a5 =  1.061405429;
      const p  =  0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x);
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return sign * y;
    };
    const Phi = (x: number): number => (1 + erf(x / Math.sqrt(2))) / 2;
    return 2 * (1 - Phi(Math.abs(z)));
  };

  for (const metric of metricsToTest) {
    for (const factor of factorKeys) {
      const pairs: [number, number][] = [];
      for (const scan of keptScans) {
        const metricValue = scan.metrics[metric];
        if (!Number.isFinite(metricValue)) continue;
        const date = scan.date;
        const factorValue = getFactorValue(date, factor);
        if (factorValue === null || !Number.isFinite(factorValue)) continue;
        const otherScans = keptScans.filter(s => s.date !== date && Math.abs(new Date(s.date).getTime() - new Date(date).getTime()) <= 10 * 24 * 60 * 60 * 1000);
        if (otherScans.length < 2) continue;
        const otherValues = otherScans.map(s => s.metrics[metric]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        if (otherValues.length < 2) continue;
        const median = getMedian(otherValues);
        const residual = (metricValue as number) - median;
        pairs.push([factorValue, residual]);
      }
      if (pairs.length < 12) continue;
      tested++;
      const x = pairs.map(p => p[0]);
      const y = pairs.map(p => p[1]);
      const rho = calculateSpearmanRho(x, y);
      const p = calculatePValue(rho, pairs.length);
      let status: "confirmé" | "à surveiller" | null = null;
      if (p < 0.05 / tested && Math.abs(rho) >= 0.3) {
        status = "confirmé";
      } else if (p < 0.05 && Math.abs(rho) >= 0.25) {
        status = "à surveiller";
      }
      if (status) {
        const metricInfo = METRICS.find(m => m.key === metric);
        if (!metricInfo) continue;
        const factorPhrase = {
          sleepH: "Après une nuit plus longue",
          alcoholG: "Après plus d'alcool la veille",
          saltG: "Après une journée plus salée",
          weightKg: "Quand ton poids est au-dessus de sa tendance"
        }[factor];
        const text = `${factorPhrase}, ${metricInfo.label.charAt(0).toLowerCase() + metricInfo.label.slice(1)} : ${rho > 0 ? metricInfo.higher : metricInfo.lower} (r = ${rho.toFixed(2).replace('.', ',')}, ${pairs.length} photos)`;
        links.push({ metric, factor, n: pairs.length, rho: Math.round(rho * 100) / 100, p: Math.round(p * 10000) / 10000, status, text });
      }
    }
  }

  links.sort((a, b) => {
    if (a.status === "confirmé" && b.status !== "confirmé") return -1;
    if (a.status !== "confirmé" && b.status === "confirmé") return 1;
    return Math.abs(b.rho) - Math.abs(a.rho);
  });

  return { tested, links };
}
