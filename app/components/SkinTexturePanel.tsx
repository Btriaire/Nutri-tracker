"use client";
import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconLoader2 } from "@tabler/icons-react";
import { analyzeSkinPhoto } from "@/app/lib/face-landmarker";
import { SKIN_INFO, skinBaseline, skinReading } from "@/app/lib/skin-info";
import type { SkinParams } from "@/app/lib/skin-texture";

type Scan = SkinParams & { id: string; at: string };

export default function SkinTexturePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (isOpen && scans.length === 0 && !loadedRef.current) {
      loadedRef.current = true;
      fetch("/api/skin-scan", { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new Error("Failed to fetch scans");
        })
        .then((data) => {
          setScans(data.scans ?? []);
        })
        .catch(() => {
          setScans([]);
        });
    }
  }, [isOpen, scans.length]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsBusy(true);
    setError(null);
    try {
      const r = await analyzeSkinPhoto(file);
      if (!r.ok) {
        let errorMessage = "Analyse impossible sur cette photo.";
        if (r.reason === "resolution") {
          errorMessage = "Photo trop petite ou visage trop loin : rapproche-toi, avec la pleine résolution de l&apos;appareil.";
        } else if (r.reason === "flou") {
          errorMessage = "Photo floue : tiens le téléphone stable et attends la mise au point.";
        } else if (r.reason === "visage") {
          errorMessage = "Visage non détecté : place-toi de face, le visage entier dans la photo.";
        }
        setError(errorMessage);
        return;
      }

      const response = await fetch("/api/skin-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          params: {
            grain: r.grain,
            lissage: r.lissage,
            ridules: r.ridules,
            taches: r.taches,
            rougeurs: r.rougeurs,
            brillance: r.brillance,
          },
          iodPx: r.iodPx,
        }),
      });

      if (!response.ok) {
        setError("Mesure non enregistrée.");
        return;
      }

      const data = await response.json();
      setScans(prev => [data.scan, ...prev]);
    } catch {
      setError("Analyse impossible sur cette photo.");
    } finally {
      setIsBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section className="glass p-4 mb-4" aria-label="Analyse de la peau">
      <button
        className="w-full flex flex-col items-start p-2 text-left"
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between w-full">
          <h2 className="text-[13px] text-[var(--text-primary)]">Analyse de la peau (option)</h2>
          <IconChevronDown className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">6 mesures à partir d&apos;une photo en haute résolution</p>
      </button>
      {isOpen && (
        <div>
          <p className="text-[13px] text-[var(--text-primary)] mt-4">
            Fais un selfie net, de face, à la lumière du jour, sans maquillage ni filtre beauté et toujours dans les mêmes conditions. La photo reste sur ton téléphone : seules les mesures sont enregistrées.
          </p>
          <button
            className="w-full p-2 mt-4 bg-[var(--indigo)] text-white min-h-[44px] flex items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
          >
            {isBusy ? (
              <>
                <IconLoader2 className="animate-spin mr-2" />
                Analyse en cours
              </>
            ) : (
              "Prendre une photo"
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            aria-hidden="true"
            onChange={handleFileChange}
          />
          {error && <p role="alert" className="text-[13px] text-[var(--error)] mt-2">{error}</p>}
          {scans.length > 0 && (
            <>
              <div className="mt-4">
                <p className="text-[13px] text-[var(--text-secondary)]">
                  {new Date(scans[0].at).toLocaleDateString("fr-FR")} · {scans.length} mesure{scans.length > 1 ? "s" : ""}
                </p>
              </div>
              {SKIN_INFO.map((info) => (
                <article key={info.key} className="mt-4">
                  <h3 className="text-[13px] text-[var(--text-primary)] font-bold">{info.label}</h3>
                  <p className="text-[13px] text-[var(--text-primary)]">
                    {scans[0][info.key].toFixed(2).replace(".", ",")} {info.unit} · {skinReading(scans[0][info.key], skinBaseline(scans.slice(1), info.key), info)}
                  </p>
                  <p className="text-[13px] text-[var(--text-secondary)]">{info.meaning}</p>
                  <details className="mt-2">
                    <summary className="text-[13px] text-[var(--text-primary)] cursor-pointer">Méthode et publications</summary>
                    <p className="text-[13px] text-[var(--text-secondary)]">{info.method}</p>
                    <ul className="list-disc pl-5 mt-2">
                      {info.refs.map((ref) => (
                        <li key={ref.url} className="text-[13px]">
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--indigo)] underline"
                          >
                            {ref.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                </article>
              ))}
              <p className="text-[13px] text-[var(--text-secondary)] mt-4">
                Ces mesures décrivent l&apos;aspect de la peau sur la photo. La lumière et l&apos;appareil les font varier : compare seulement des photos prises dans les mêmes conditions. Les publications relient ces traits à la perception du visage, ou à la méthode de mesure : elles ne prouvent pas un état de santé et ceci n&apos;est pas un diagnostic. Une lésion qui change ou saigne se montre à un médecin.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
