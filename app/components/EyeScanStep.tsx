"use client";

import { IconCircleCheck } from "@tabler/icons-react";

export function EyeDoneScreen({ label, image, score }: { label: string; image: string | null; score: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-transparent">
      <IconCircleCheck size={56} className="text-[var(--ok)]" />
      <h2 className="text-[24px] font-bold text-[var(--text-primary)] mt-4">{label} capturé</h2>
      {image && (
        <img
          src={image}
          alt="Meilleure image"
          className="w-[160px] h-[160px] rounded-full mt-4"
        />
      )}
      <p className="text-[14px] text-[var(--text-secondary)] mt-2">Qualité {score} %</p>
    </div>
  );
}

export function EyeChoiceScreen({ onFinish, onAdvanced }: { onFinish: () => void; onAdvanced: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-transparent">
      <h1 className="text-[22px] font-bold text-[var(--text-primary)]">Scan des yeux terminé</h1>
      <button
        onClick={onFinish}
        className="w-full max-w-[320px] min-h-[56px] bg-[#6366f1] text-white rounded-md mt-4"
      >
        Terminer maintenant
      </button>
      <button
        onClick={onAdvanced}
        className="w-full max-w-[320px] min-h-[56px] border border-[var(--border)] bg-transparent rounded-md mt-2"
      >
        <div className="text-[16px]">Analyses avancées (≈ 20 s)</div>
        <div className="text-[12px] text-[var(--text-secondary)]">Réflexe pupillaire, conjonctive, sécheresse</div>
      </button>
    </div>
  );
}
