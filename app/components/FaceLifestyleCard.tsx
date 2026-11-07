"use client";

import { useEffect, useState } from "react";
import type { LifestyleLink } from "@/app/lib/face-lifestyle";

export default function FaceLifestyleCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<{ tested: number; links: LifestyleLink[]; photos: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/face-scan/lifestyle", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const confirmed = data?.links.filter((link) => link.status === "confirmé") || [];
  const watch = data?.links.filter((link) => link.status === "à surveiller") || [];

  return (
    <section className="glass p-4 mb-4" aria-label="Visage et mode de vie">
      <h2 style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)" }}>Visage et mode de vie</h2>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
        Chaque mesure de ton visage est comparée à ton sommeil, à l&apos;alcool et au sel de la veille, et à ton poids, sur tes propres données.
      </p>
      {loading && <p>Calcul en cours…</p>}
      {error && <p>Calcul impossible pour le moment.</p>}
      {data && (
        <>
          <p>{`${data.tested} liens testés sur ${data.photos} photos.`}</p>
          {confirmed.length > 0 ? (
            <>
              <h3 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginTop: "12px" }}>Liens confirmés</h3>
              <ul style={{ marginLeft: "20px" }}>
                {confirmed.map((link) => (
                  <li key={link.text} style={{ fontSize: "13px", color: "var(--text-primary)", listStyleType: "disc", marginLeft: "5px" }}>{link.text}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>Aucun lien confirmé pour l&apos;instant : avec autant de comparaisons, il faut un effet net et répété pour l&apos;affirmer.</p>
          )}
          {watch.length > 0 && (
            <>
              <h3 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginTop: "12px" }}>À surveiller</h3>
              <ul style={{ marginLeft: "20px" }}>
                {watch.map((link) => (
                  <li key={link.text} style={{ fontSize: "13px", color: "var(--text-primary)", listStyleType: "disc", marginLeft: "5px" }}>{link.text}</li>
                ))}
              </ul>
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>Signal faible : pourrait venir du hasard. À revoir quand tu auras plus de photos.</p>
            </>
          )}
        </>
      )}
      <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
        Un lien n&apos;est pas une cause : un autre facteur peut expliquer les deux. Les mesures et les comparaisons sont recalculées à chaque ouverture.
      </p>
    </section>
  );
}
