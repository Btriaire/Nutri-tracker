// Icône de l'appli (même image que l'écran d'accueil du téléphone).
export default function AppIcon({ size = 96, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/icon-512.png" alt="" width={size} height={size} className={className} style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
}
