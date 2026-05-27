export function Shimmer({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className}`}
      style={{ background: "rgba(255,255,255,0.07)", ...style }}
    />
  );
}

interface Props {
  title: string;
  subtitle?: string;
}

export default function PageSkeleton({ title, subtitle }: Props) {
  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-2xl" style={{ paddingBottom: "80px" }}>
        {/* Header */}
        <div className="mb-6">
          <Shimmer className="h-3 w-20 mb-1.5" />
          <p className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {title}
          </p>
          {subtitle && <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
        </div>
        {/* Cards */}
        <Shimmer className="h-[220px] w-full mb-4" />
        <Shimmer className="h-[120px] w-full mb-4" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Shimmer className="h-[90px]" />
          <Shimmer className="h-[90px]" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Shimmer className="h-[80px]" />
          <Shimmer className="h-[80px]" />
          <Shimmer className="h-[80px]" />
        </div>
        <Shimmer className="h-[100px] w-full mb-4" />
        <Shimmer className="h-[80px] w-full" />
      </div>
    </div>
  );
}
