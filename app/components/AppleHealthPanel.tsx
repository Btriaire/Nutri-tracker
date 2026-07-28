"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronDown, IconChevronUp, IconCircleCheck, IconCopy, IconCheck, IconLoader2, IconHeartbeat,
} from "@tabler/icons-react";

export default function AppleHealthPanel() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  useEffect(() => {
    fetch("/api/apple-health/token", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { token: null })
      .then((data: { token: string | null }) => setToken(data.token))
      .catch(() => {});
  }, []);

  const generateToken = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/apple-health/token", { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { token: string };
        setToken(data.token);
      }
    } finally {
      setLoading(false);
    }
  };

  const ingestUrl = typeof window !== "undefined" ? `${window.location.origin}/api/apple-health/ingest` : "/api/apple-health/ingest";

  const copyText = (text: string, which: "url" | "token") => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="glass p-5 mb-4"
    >
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #ff2d55 0%, #ff375f 100%)" }}>
          <IconHeartbeat size={18} color="white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Apple Health</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas · FC · Sommeil · Poids via Shortcuts</p>
        </div>
        {token && <IconCircleCheck size={18} style={{ color: "var(--fiber)", flexShrink: 0 }} />}
        {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
            <div className="mt-4 space-y-3">
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Apple n&apos;offre pas d&apos;API web pour HealthKit — la synchronisation passe par un
                <strong style={{ color: "var(--text-secondary)" }}> Raccourci (Shortcuts)</strong> sur ton iPhone
                qui envoie tes données à cette adresse, ou par l&apos;app <strong style={{ color: "var(--text-secondary)" }}>Health Auto Export</strong> (App Store, ~5€).
              </p>

              {!token ? (
                <button onClick={generateToken} disabled={loading}
                  className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
                  {loading ? <IconLoader2 size={14} className="animate-spin" /> : null}
                  Générer mon token de connexion
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                    <IconCircleCheck size={13} style={{ color: "var(--fiber)" }} />
                    <span className="text-[12px]" style={{ color: "var(--fiber)" }}>Token actif</span>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>URL du webhook</label>
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg text-[11px] font-mono break-all"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        {ingestUrl}
                      </div>
                      <button onClick={() => copyText(ingestUrl, "url")}
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}>
                        {copied === "url" ? <IconCheck size={14} style={{ color: "var(--fiber)" }} /> : <IconCopy size={14} style={{ color: "var(--indigo)" }} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Token</label>
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg text-[11px] font-mono break-all"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        {token}
                      </div>
                      <button onClick={() => token && copyText(token, "token")}
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}>
                        {copied === "token" ? <IconCheck size={14} style={{ color: "var(--fiber)" }} /> : <IconCopy size={14} style={{ color: "var(--indigo)" }} />}
                      </button>
                    </div>
                  </div>

                  <button onClick={generateToken} disabled={loading}
                    className="w-full text-[11px] font-medium py-1.5"
                    style={{ color: "var(--text-muted)" }}>
                    Régénérer le token (invalide l&apos;ancien)
                  </button>
                </>
              )}

              <div className="rounded-lg p-3 space-y-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>Créer le Raccourci — guide détaillé (gratuit, ~15 min) :</p>

                <div>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--indigo)" }}>1. Créer le raccourci</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    App <strong>Raccourcis</strong> (icône violette) → onglet Raccourcis → <strong>+</strong> en haut à droite → renomme-le &quot;Sync Santé&quot;
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--indigo)" }}>2. Ajouter les données Santé</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Pour chaque métrique (pas, FC repos, sommeil, poids) : <strong>+</strong> → cherche &quot;Obtenir les échantillons de santé&quot; → choisis le type → plage &quot;Aujourd&apos;hui&quot;. Ajoute juste après un bloc &quot;Calculer la statistique&quot; (Somme pour pas/sommeil, Moyenne pour FC) en entrée = sortie du bloc précédent.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--indigo)" }}>3. Construire le paquet de données</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Ajoute un bloc &quot;Dictionnaire&quot; → &quot;Ajouter un élément&quot; pour chaque ligne : <code>token</code> (colle ton token, texte fixe), <code>date</code> (Sélectionner une variable → Date actuelle, format AAAA-MM-JJ), puis <code>steps</code>, <code>heartRateResting</code>, <code>sleepMinutes</code>, <code>weightKg</code> — pour chacune, tape le champ → &quot;Sélectionner une variable&quot; → choisis la sortie &quot;Calculer la statistique&quot; correspondante.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--indigo)" }}>4. Envoyer les données</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Ajoute &quot;Obtenir le contenu de l&apos;URL&quot; → colle l&apos;URL ci-dessus → &quot;Afficher plus&quot; → Méthode : <strong>POST</strong> → Corps de la requête : <strong>JSON</strong> → tape le corps → &quot;Sélectionner une variable&quot; → choisis <strong>tout le Dictionnaire</strong> de l&apos;étape 3 (pas champ par champ).
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--indigo)" }}>5. Tester</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Bouton ▶ en bas pour lancer une fois → autorise l&apos;accès Santé si demandé → vérifie dans Nutri-Tracker que les données arrivent.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--indigo)" }}>6. Automatiser (tous les jours)</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Onglet <strong>Automatisation</strong> → <strong>+</strong> → &quot;Créer une automatisation personnelle&quot; → &quot;Heure de la journée&quot; (ex: 8h, après le réveil) → &quot;Exécuter le raccourci&quot; → &quot;Sync Santé&quot; → <strong>désactive &quot;Demander avant d&apos;exécuter&quot;</strong>.
                  </p>
                </div>

                <p className="text-[10px] pt-1.5" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                  Trop fastidieux ? L&apos;app <strong>Health Auto Export</strong> (App Store, ~5€) fait tout ça sans montage manuel : colle juste l&apos;URL et le token dans ses réglages.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
