"use client";

import { useMemo } from "react";
import type { FollowUpScan } from "@/app/lib/eye-followup";
import { eyeFollowUp } from "@/app/lib/eye-followup";

export default function EyeFollowUpCard({ scans }: { scans: FollowUpScan[] }) {
  const { rows, count, sinceDays } = useMemo(() => eyeFollowUp(scans), [scans]);

  return (
    <div className="glass p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Suivi</h2>
          <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{count} scans</p>
          {sinceDays !== null && (
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Dernier scan il y a {sinceDays} j avant celui-ci
            </p>
          )}
        </div>
      </div>
      {count < 2 ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Fais un deuxième scan pour voir l&apos;évolution.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <tbody>
              {rows.map((row) => (
                row.latest !== null && (
                  <tr key={row.key} className="border-b border-border last:border-b-0">
                    <td className="py-2 px-4">{row.label}</td>
                    <td className="py-2 px-4">
                      {row.latest.toFixed(2)} {row.unit}
                    </td>
                    <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                      {row.deltaPrev !== null && (
                        <span>{row.deltaPrev >= 0 ? '+' : ''}{row.deltaPrev.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      {row.trend === "up" && <span aria-label="en hausse">↑</span>}
                      {row.trend === "down" && <span aria-label="en baisse">↓</span>}
                      {row.trend === "flat" && <span aria-label="stable">→</span>}
                    </td>
                    <td className="py-2 px-4">
                      <svg width="64" height="20" viewBox="0 0 64 20" className="w-16 h-5">
                        <polyline
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                          points={row.points.map((point, i) => {
                            const x = (i / (row.points.length - 1)) * 64;
                            const y = 20 - ((point - Math.min(...row.points)) / (Math.max(...row.points) - Math.min(...row.points))) * 20;
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                      </svg>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-top" style={{ borderTop: "1px solid var(--border)" }}></div>
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Compare chaque mesure au scan précédent et à ta médiane des 5 derniers. Pas un diagnostic.
      </p>
    </div>
  );
}
