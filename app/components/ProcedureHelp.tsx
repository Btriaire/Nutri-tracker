"use client";

import { useState } from "react";
import { IconHelpCircle } from "@tabler/icons-react";
import Sheet from "./Sheet";

export interface Procedure {
  title: string;
  before: string[];
  steps: { title: string; detail: string }[];
  tips: string[];
  avoid?: string[];
}

/** Bouton « ? » qui ouvre la procedure pas a pas d'une mesure. */
export default function ProcedureHelp({ procedure }: { procedure: Procedure }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Comment faire : ${procedure.title}`}
        className="shrink-0 flex items-center justify-center w-10 h-10 -my-2 rounded-full" style={{ color: "var(--text-secondary)" }}>
        <IconHelpCircle size={20} stroke={1.8} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={procedure.title}>
        <div className="space-y-4 pb-2">
          <section>
            <h3 className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Avant de commencer</h3>
            <ul className="space-y-1">
              {procedure.before.map((b) => <li key={b} className="text-[13px]" style={{ color: "var(--text-secondary)" }}>• {b}</li>)}
            </ul>
          </section>
          <section>
            <h3 className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Étapes</h3>
            <ol className="space-y-2">
              {procedure.steps.map((s, i) => (
                <li key={s.title} className="flex gap-2.5">
                  <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-semibold"
                    style={{ background: "color-mix(in srgb, var(--indigo) 16%, transparent)", color: "var(--indigo)" }}>{i + 1}</span>
                  <span className="text-[13px]">
                    <strong style={{ color: "var(--text-primary)" }}>{s.title}</strong>
                    <span className="block" style={{ color: "var(--text-secondary)" }}>{s.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h3 className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Pour des résultats comparables</h3>
            <ul className="space-y-1">
              {procedure.tips.map((t) => <li key={t} className="text-[13px]" style={{ color: "var(--text-secondary)" }}>• {t}</li>)}
            </ul>
          </section>
          {procedure.avoid && (
            <section>
              <h3 className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>À éviter</h3>
              <ul className="space-y-1">
                {procedure.avoid.map((t) => <li key={t} className="text-[13px]" style={{ color: "var(--text-secondary)" }}>• {t}</li>)}
              </ul>
            </section>
          )}
        </div>
      </Sheet>
    </>
  );
}

export const EYE_PROCEDURE: Procedure = {
  title: "Scan de l'œil",
  before: [
    "Retire tes lunettes (lentilles de contact transparentes : ça va ; lentilles colorées : retire-les).",
    "Pièce plutôt sombre ou lumière douce : c'est l'écran qui éclaire tes yeux. Monte la luminosité de l'écran au maximum.",
    "Assieds-toi, tiens le téléphone à hauteur des yeux, à 25-30 cm (une main ouverte et demie). Le poser contre un objet aide à rester stable.",
    "Mains propres pour l'étape de la paupière.",
  ],
  steps: [
    { title: "Yeux grands ouverts (3 s)", detail: "Regarde le centre de l'écran, tête droite, sans sourire ni plisser les yeux. Le cadre devient vert quand ton visage est détecté." },
    { title: "Réflexe pupillaire (4 s)", detail: "L'écran devient noir puis flashe en blanc : garde les yeux ouverts et fixes, sans cligner, jusqu'au message suivant." },
    { title: "Paupière inférieure (3 s pour te préparer)", detail: "Avec l'index, tire doucement la peau sous un œil vers le bas pour montrer l'intérieur rose de la paupière, et regarde vers le haut. Garde la position jusqu'à « Ne bouge pas ». Un seul œil suffit." },
    { title: "Test de sécheresse (optionnel)", detail: "Appuie sur « Commencer », puis garde les yeux ouverts naturellement, sans forcer. Cligne dès que c'est inconfortable : le chronomètre s'arrête au premier clignement. « Passer » si tu ne veux pas le faire." },
  ],
  tips: [
    "Même moment de la journée (le matin, avant les écrans, c'est l'idéal), même pièce et même lumière.",
    "Une à deux fois par semaine suffit. Les index se comparent à ton habitude à partir du 3e scan.",
    "Si l'appli signale « Pupille peu visible » ou « Tête tournée », refais simplement le scan.",
  ],
  avoid: [
    "Œil irrité, infection ou douleur : pas de scan, et consulte si ça persiste.",
    "Juste après des gouttes qui dilatent la pupille (chez l'ophtalmologue) : les mesures seraient faussées.",
  ],
};

export const VITALS_PROCEDURE: Procedure = {
  title: "Mesurer ton pouls par la caméra",
  before: [
    "Assieds-toi et reste au calme 2 à 3 minutes avant (pas juste après un effort, un café ou un escalier).",
    "Lumière stable et de face (fenêtre ou lampe devant toi), pas de contre-jour ni de lumière qui clignote.",
    "Téléphone posé ou tenu à deux mains, à 30-40 cm, à hauteur du visage.",
  ],
  steps: [
    { title: "Lance « Mesurer mon pouls »", detail: "Place ton visage dans l'ovale : le contour devient vert." },
    { title: "Ne bouge pas, ne parle pas", detail: "Respire normalement. Le pouls se lit dans les micro-variations de couleur de la peau : le moindre mouvement brouille le signal." },
    { title: "Arrêt automatique (10 à 20 s)", detail: "La mesure s'arrête seule dès que le pouls est stable. Tu peux aussi appuyer sur « Terminer maintenant » à partir de 10 s." },
    { title: "Option : mesure longue (25 s)", detail: "Seulement si tu veux aussi la respiration : il faut plusieurs cycles respiratoires pour l'estimer." },
  ],
  tips: [
    "Le matin au réveil, assis, donne le pouls de repos le plus fiable et le plus comparable.",
    "Compare de temps en temps avec ta montre : l'appli affiche sa moyenne du jour à côté.",
    "Si l'appli indique une confiance faible, refais la mesure avec plus de lumière.",
  ],
};

export const FACE_PROCEDURE: Procedure = {
  title: "Photo du visage",
  before: [
    "Lumière naturelle de face (face à une fenêtre), pas de lampe colorée ni de contre-jour.",
    "Visage dégagé : cheveux en arrière, sans lunettes, idéalement sans maquillage.",
    "Expression neutre, bouche fermée, regard vers l'objectif.",
  ],
  steps: [
    { title: "Prendre une photo", detail: "Aligne ton visage dans l'ovale, de face, téléphone à hauteur des yeux à bout de bras." },
    { title: "Vérifie le message de qualité", detail: "Sous la photo, l'appli indique la qualité (angle, lumière). En dessous de 60/100, reprends la photo : elle ne comptera pas dans ta référence." },
    { title: "Analyser", detail: "Choisis la comparaison (dernier scan ou premier scan) puis « Analyser »." },
  ],
  tips: [
    "Même endroit, même heure et même lumière à chaque fois : c'est ce qui rend l'évolution fiable.",
    "Une photo par semaine suffit pour suivre le volume du visage et le teint.",
    "Pas de filtre ni de mode portrait.",
  ],
};
