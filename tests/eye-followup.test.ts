import { describe, expect, test } from 'vitest';
import { eyeFollowUp, FollowUpScan } from '@/app/lib/eye-followup';

describe('eyeFollowUp', () => {
  test('un seul scan', () => {
    const scans: FollowUpScan[] = [
      {
        date: '2026-11-04',
        metrics: {
          A: { pupilMm: 3.0, fenteRatio: 0.5, mrd1Mm: 10.0, rednessA: 10.0, scleraB: 20.0, cernes: 50.0 },
          B: { pupilMm: 3.0, fenteRatio: 0.5, mrd1Mm: 10.0, rednessA: 10.0, scleraB: 20.0, cernes: 50.0 },
          anisocoriaMm: 0.0,
          quality: { score: 100 },
        },
      },
    ];

    const result = eyeFollowUp(scans);
    expect(result.count).toBe(1);
    expect(result.sinceDays).toBeNull();
    result.rows.forEach(row => {
      expect(row.trend).toBe('na');
    });
  });

  test('trois scans avec pupilMm croissant', () => {
    const scans: FollowUpScan[] = [
      {
        date: '2026-11-04',
        metrics: {
          A: { pupilMm: 3.6 },
          B: { pupilMm: 3.6 },
          anisocoriaMm: 0.0,
          quality: { score: 100 },
        },
      },
      {
        date: '2026-11-03',
        metrics: {
          A: { pupilMm: 3.2 },
          B: { pupilMm: 3.2 },
          anisocoriaMm: 0.0,
          quality: { score: 100 },
        },
      },
      {
        date: '2026-11-02',
        metrics: {
          A: { pupilMm: 3.0 },
          B: { pupilMm: 3.0 },
          anisocoriaMm: 0.0,
          quality: { score: 100 },
        },
      },
    ];

    const result = eyeFollowUp(scans);
    const pupilRow = result.rows.find(row => row.key === 'pupilMm');
    expect(pupilRow?.latest).toBe(3.6);
    expect(pupilRow?.previous).toBe(3.2);
    expect(pupilRow?.deltaPrev).toBe(0.4);
    expect(pupilRow?.baseline).toBe(3.1);
    expect(pupilRow?.trend).toBe('up');
  });

  test('valeurs null ignorees', () => {
    const scans: FollowUpScan[] = [
      {
        date: '2026-11-04',
        metrics: {
          A: { pupilMm: null },
          B: { pupilMm: 3.6 },
          anisocoriaMm: null,
          quality: { score: 100 },
        },
      },
      {
        date: '2026-11-03',
        metrics: {
          A: { pupilMm: 3.2 },
          B: { pupilMm: null },
          anisocoriaMm: 0.0,
          quality: { score: 100 },
        },
      },
      {
        date: '2026-11-02',
        metrics: {
          A: { pupilMm: null },
          B: { pupilMm: 3.0 },
          anisocoriaMm: null,
          quality: { score: 100 },
        },
      },
    ];

    const result = eyeFollowUp(scans);
    const pupilRow = result.rows.find(row => row.key === 'pupilMm');
    expect(pupilRow?.latest).toBe(3.6);
    expect(pupilRow?.previous).toBe(3.2);
    expect(pupilRow?.deltaPrev).toBe(0.4);
    expect(pupilRow?.baseline).toBe(3.1);
    expect(pupilRow?.trend).toBe('up');
  });

  test('sinceDays entre 2026-11-04 et 2026-10-31 vaut 4', () => {
    const scans: FollowUpScan[] = [
      {
        date: '2026-11-04',
        metrics: {
          A: { pupilMm: 3.6 },
          B: { pupilMm: 3.6 },
          anisocoriaMm: 0.0,
          quality: { score: 100 },
        },
      },
      {
        date: '2026-10-31',
        metrics: {
          A: { pupilMm: 3.2 },
          B: { pupilMm: 3.2 },
          anisocoriaMm: 0.0,
          quality: { score: 100 },
        },
      },
    ];

    const result = eyeFollowUp(scans);
    expect(result.sinceDays).toBe(4);
  });

  test('points limites a 12 et ordonnes du plus ancien au plus recent', () => {
    const scans: FollowUpScan[] = Array.from({ length: 15 }, (_, i) => ({
      date: `2026-11-${String(4 - i).padStart(2, '0')}`,
      metrics: {
        A: { pupilMm: 3.0 + i * 0.1 },
        B: { pupilMm: 3.0 + i * 0.1 },
        anisocoriaMm: 0.0,
        quality: { score: 100 },
      },
    }));

    const result = eyeFollowUp(scans);
    const pupilRow = result.rows.find(row => row.key === 'pupilMm');
    expect(pupilRow?.points.length).toBe(12);
    // scans[0] est le plus recent (3.0) ; les 12 plus recents, du plus ancien au plus recent : 4.1 ... 3.0
    expect(pupilRow?.points).toEqual([4.1, 4.0, 3.9, 3.8, 3.7, 3.6, 3.5, 3.4, 3.3, 3.2, 3.1, 3.0]);
  });
});
