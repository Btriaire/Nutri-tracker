import type { Metadata } from "next";
import OfflineMealCapture from "@/app/components/OfflineMealCapture";

export const metadata: Metadata = { title: "Hors ligne · Nutri-Tracker" };

// Page de secours servie par le service worker quand une page n'est pas disponible sans reseau.
// Aucune donnee personnelle : seulement la saisie locale des repas.
export default function OfflinePage() {
  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-[22px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Pas de connexion</h1>
      <p className="text-[13px] mb-5" style={{ color: "var(--text-secondary)" }}>
        Cette page n&apos;est pas disponible hors ligne. Tu peux quand même noter tes repas : ils seront ajoutés
        à ton journal dès que le réseau revient.
      </p>
      <OfflineMealCapture alwaysShowForm />
      {/* Lien classique (pas <Link>) : un vrai rechargement repasse par le service worker et le reseau. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/log" className="flex items-center justify-center min-h-[48px] rounded-xl text-[14px] font-medium"
        style={{ background: "var(--layer-2)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>
        Réessayer d&apos;ouvrir le journal
      </a>
    </main>
  );
}
