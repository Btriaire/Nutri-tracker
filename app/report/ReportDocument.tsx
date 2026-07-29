import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IconUser, IconHeart, IconBarbell, IconLeaf, IconDroplet, IconShoe, IconMoon, IconFlame,
  IconArrowDown, IconArrowUp, IconMinus, IconAlertCircle,
} from "@tabler/icons-react";
import { format as dateFnsFormat, parseISO } from "date-fns";
import type { ReportData, DayNutrition, DayActivity } from "@/app/lib/report-builder";

const AXIS_LABEL: Record<string, string> = {
  amaigrissement: "Amaigrissement", fatigue: "Fatigue", teint: "Teint", hydratation: "Hydratation",
};

// ─── Tiny SVG bar chart ───────────────────────────────────────────────────────

function MiniBarChart({
  data, color, height = 48, maxOverride,
}: {
  data: { val: number | null; label: string }[];
  color: string;
  height?: number;
  maxOverride?: number;
}) {
  const vals  = data.map(d => d.val ?? 0);
  const maxV  = maxOverride ?? Math.max(...vals, 1);
  const W     = 100;
  const H     = height;
  const barW  = Math.max(1, W / data.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: "block" }}>
      {data.map((d, i) => {
        const h = d.val ? Math.max(2, (d.val / maxV) * H) : 0;
        const x = i * (W / data.length);
        return (
          <rect
            key={i}
            x={x + 0.5}
            y={H - h}
            width={Math.max(barW - 0.5, 0.5)}
            height={h}
            fill={d.val ? color : "transparent"}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

// ─── Macro donut ──────────────────────────────────────────────────────────────

function MacroDonut({ p, c, f }: { p: number; c: number; f: number }) {
  const total = p + c + f || 1;
  const pPct  = p / total;
  const cPct  = c / total;
  const fPct  = f / total;

  const R = 28;
  const cx = 36;
  const cy = 36;
  const circumference = 2 * Math.PI * R;

  const segments = [
    { pct: pPct, color: "#a78bfa", label: "P" },
    { pct: cPct, color: "#fbbf24", label: "G" },
    { pct: fPct, color: "#60a5fa", label: "L" },
  ];

  let offset = 0;
  return (
    <svg viewBox="0 0 72 72" width="72" height="72">
      {segments.map(({ pct, color, label }) => {
        const dash   = pct * circumference;
        const gap    = circumference - dash;
        const rotate = offset * 360 - 90;
        offset      += pct;
        return (
          <circle
            key={label}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rotate} ${cx} ${cy})`}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={20} fill="transparent" />
    </svg>
  );
}

// ─── Goal ring ────────────────────────────────────────────────────────────────

function GoalRing({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const R   = size / 2 - 5;
  const c   = 2 * Math.PI * R;
  const p   = Math.min(pct / 100, 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={R}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${p * c} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ─── Score badge ─────────────────────────────────────────────────────────────

export function score(pct: number) {
  if (pct >= 90) return { label: "Excellent", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" };
  if (pct >= 70) return { label: "Bon",        color: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.3)" };
  if (pct >= 50) return { label: "Passable",   color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" };
  return               { label: "À améliorer", color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return format(new Date(d + "T12:00:00"), "d MMM yyyy", { locale: fr });
}
function fmtN(n: number | null, unit = "", dec = 0) {
  if (n === null || n === undefined) return "—";
  return dec ? n.toFixed(dec) + unit : Math.round(n) + unit;
}

// ─── Report sections ─────────────────────────────────────────────────────────

function SectionTitle({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 report-section-title"
      style={{ borderBottom: `2px solid ${color}33` }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <span className="text-[15px]">{icon}</span>
      </div>
      <h2 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <div className="flex-1 h-px ml-2" style={{ background: `${color}20` }} />
    </div>
  );
}

function KpiCard({
  icon, label, value, unit, sub, color, pct,
}: {
  icon: React.ReactNode; label: string; value: string; unit?: string;
  sub?: string; color: string; pct?: number;
}) {
  return (
    <div className="glass p-3.5 flex items-start gap-3 report-card">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5"
          style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-[18px] font-bold leading-none" style={{ color }}>
          {value}{unit && <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>}
        </p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
      {pct !== undefined && <GoalRing pct={pct} color={color} size={36} />}
    </div>
  );
}

// ─── Main document (shared by the interactive report view and the print/PDF pipeline) ─

export default function ReportDocument({ data }: { data: ReportData }) {
  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════
          COVER PAGE
      ═══════════════════════════════════════════════════════════ */}
      <div className="report-cover mb-6 rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(167,139,250,0.12),rgba(96,165,250,0.08))", border: "1px solid var(--border)" }}>

        {/* Top accent bar */}
        <div style={{ height: 4, background: "linear-gradient(90deg,#f97316,#a78bfa,#60a5fa)" }} />

        <div className="p-6 md:p-8">
          {/* Logo + title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#f97316,#fb923c)" }}>
              <span className="text-[18px]">🥦</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>NutriTracker</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Rapport de santé personnel</p>
            </div>
          </div>

          {/* User identity */}
          <div className="flex items-center gap-4 mb-8">
            {data.profile.photoUrl ? (
              <img src={data.profile.photoUrl} alt="avatar"
                className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                style={{ border: "2px solid rgba(249,115,22,0.4)" }} />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(249,115,22,0.15)", border: "2px solid rgba(249,115,22,0.3)" }}>
                <IconUser size={28} style={{ color: "#f97316" }} />
              </div>
            )}
            <div>
              <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {data.profile.displayName}
              </h1>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{data.profile.email}</p>
            </div>
          </div>

          {/* Period + meta */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "📅", label: "Période analysée", value: `${fmtDate(data.meta.from)} → ${fmtDate(data.meta.to)}` },
              { icon: "📊", label: "Durée",            value: `${data.meta.totalDays} jours calendaires` },
              { icon: "🍽️", label: "Jours enregistrés (nutrition)", value: `${data.nutrition.daysLogged} jours` },
              { icon: "🏃", label: "Jours avec activité",           value: `${data.activity.daysWithData} jours` },
              { icon: "💊", label: "Observance suppléments",        value: data.supplements.productsCount ? `${data.supplements.overallAdherencePct}%` : "—" },
              { icon: "🔎", label: "Scans visage",                  value: `${data.faceScan.scansCount}` },
            ].map(({ icon, label, value }) => (
              <div key={label} className="glass p-3 rounded-xl">
                <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{icon} {label}</p>
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] mt-4 text-right" style={{ color: "var(--text-muted)" }}>
            Généré le {format(new Date(data.meta.generatedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RÉSUMÉ EXÉCUTIF
      ═══════════════════════════════════════════════════════════ */}
      <div className="glass p-5 mb-5 report-page-break">
        <SectionTitle icon="📋" title="Résumé exécutif" color="#f97316" />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <KpiCard
            icon={<IconFlame size={14} style={{ color: "#f97316" }} />}
            label="Calories moy / jour"
            value={fmtN(data.nutrition.avgCalories)}
            unit="kcal"
            sub={`Objectif : ${data.profile.goals.dailyCalories} kcal`}
            color="#f97316"
            pct={data.nutrition.pctCalGoal}
          />
          <KpiCard
            icon={<IconLeaf size={14} style={{ color: "#a78bfa" }} />}
            label="Protéines moy / jour"
            value={fmtN(data.nutrition.avgProteinG)}
            unit="g"
            sub={`Objectif : ${data.profile.goals.proteinGrams} g`}
            color="#a78bfa"
            pct={data.profile.goals.proteinGrams ? Math.round(data.nutrition.avgProteinG / data.profile.goals.proteinGrams * 100) : 0}
          />
          <KpiCard
            icon={<IconShoe size={14} style={{ color: "#4285F4" }} />}
            label="Pas moy / jour"
            value={data.activity.avgSteps ? data.activity.avgSteps.toLocaleString("fr-FR") : "—"}
            sub={`Objectif : ${data.profile.goals.stepsGoal.toLocaleString("fr-FR")}`}
            color="#4285F4"
            pct={data.activity.pctStepsGoal}
          />
          <KpiCard
            icon={<IconMoon size={14} style={{ color: "#7986CB" }} />}
            label="Sommeil moy / nuit"
            value={fmtN(data.activity.avgSleepH, "h", 1)}
            sub={`Objectif : ${(data.profile.goals.sleepGoalMin / 60).toFixed(1)}h`}
            color="#7986CB"
            pct={data.activity.pctSleepGoal}
          />
          <KpiCard
            icon={<IconHeart size={14} style={{ color: "#EA4335" }} />}
            label="FC moyenne"
            value={fmtN(data.health.avgHR)}
            unit="bpm"
            sub={data.health.avgSys ? `Tension : ${data.health.avgSys}/${data.health.avgDia} mmHg` : "Pas de mesure"}
            color="#EA4335"
          />
          <KpiCard
            icon={<IconDroplet size={14} style={{ color: "#60a5fa" }} />}
            label="Hydratation moy"
            value={fmtN(data.nutrition.avgWaterMl)}
            unit="mL"
            sub={`Objectif : ${data.profile.goals.waterMl} mL`}
            color="#60a5fa"
            pct={data.nutrition.pctWaterGoal}
          />
        </div>

        {/* Score globaux */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Nutrition",  pct: data.nutrition.pctCalGoal },
            { label: "Activité",   pct: data.activity.pctStepsGoal },
            { label: "Hydratation",pct: data.nutrition.pctWaterGoal },
          ].map(({ label, pct }) => {
            const s = score(pct);
            return (
              <div key={label} className="flex flex-col items-center gap-1 py-3 rounded-xl"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: s.color }}>{label}</p>
                <p className="text-[16px] font-bold" style={{ color: s.color }}>{pct}%</p>
                <p className="text-[9px]" style={{ color: s.color }}>{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          NUTRITION
      ═══════════════════════════════════════════════════════════ */}
      <div className="glass p-5 mb-5">
        <SectionTitle icon="🍽️" title="Nutrition" color="#f97316" />

        <div className="grid grid-cols-2 gap-4 mb-5">
          {/* Macro donut */}
          <div className="flex items-center gap-3">
            <MacroDonut
              p={data.nutrition.avgProteinG * 4}
              c={data.nutrition.avgCarbsG   * 4}
              f={data.nutrition.avgFatG      * 9}
            />
            <div className="space-y-1.5">
              {[
                { label: "Protéines", val: data.nutrition.avgProteinG, goal: data.profile.goals.proteinGrams, color: "#a78bfa", unit: "g" },
                { label: "Glucides",  val: data.nutrition.avgCarbsG,   goal: data.profile.goals.carbsGrams,   color: "#fbbf24", unit: "g" },
                { label: "Lipides",   val: data.nutrition.avgFatG,     goal: data.profile.goals.fatGrams,     color: "#60a5fa", unit: "g" },
                { label: "Fibres",    val: data.nutrition.avgFiberG,   goal: data.profile.goals.fiberGrams,   color: "#34d399", unit: "g" },
              ].map(({ label, val, goal, color, unit }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span className="text-[11px] font-semibold ml-auto" style={{ color }}>{val}{unit}</span>
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Water + fiber stats */}
          <div className="space-y-2">
            {[
              { icon: "💧", label: "Eau / jour",     val: data.nutrition.avgWaterMl,  goal: data.profile.goals.waterMl,   unit: " mL",  color: "#60a5fa" },
              { icon: "🌿", label: "Fibres / jour",  val: data.nutrition.avgFiberG,   goal: data.profile.goals.fiberGrams, unit: " g",  color: "#34d399" },
              { icon: "📅", label: "Jours loggés",   val: data.nutrition.daysLogged,  goal: data.meta.totalDays,          unit: " j",  color: "#f97316" },
            ].map(({ icon, label, val, goal, unit, color }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-[12px]">{icon}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                </div>
                <span className="text-[12px] font-semibold" style={{ color }}>
                  {val}{unit} <span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Calories trend */}
        {data.nutrition.daily.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Évolution des calories
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 rounded" style={{ background: "#f97316" }} />
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Calories</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-px" style={{ background: "rgba(249,115,22,0.4)" }} />
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Objectif</span>
                </div>
              </div>
            </div>
            <div className="relative rounded-xl overflow-hidden" style={{ height: 70, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <MiniBarChart
                data={(data.nutrition.daily as DayNutrition[]).map(d => ({ val: d.calories, label: d.date }))}
                color="#f97316"
                height={70}
                maxOverride={Math.max(data.profile.goals.dailyCalories * 1.3, ...data.nutrition.daily.map((d: DayNutrition) => d.calories))}
              />
              {/* Goal line overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <svg width="100%" height="100%" viewBox="0 0 100 70" preserveAspectRatio="none">
                  <line
                    x1="0" y1={70 - (data.profile.goals.dailyCalories / (data.profile.goals.dailyCalories * 1.3)) * 70}
                    x2="100" y2={70 - (data.profile.goals.dailyCalories / (data.profile.goals.dailyCalories * 1.3)) * 70}
                    stroke="rgba(249,115,22,0.4)" strokeWidth={0.8} strokeDasharray="3 2"
                  />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ACTIVITÉ PHYSIQUE
      ═══════════════════════════════════════════════════════════ */}
      <div className="glass p-5 mb-5 report-page-break">
        <SectionTitle icon="🏃" title="Activité physique" color="#34A853" />

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { icon: <IconShoe size={13} style={{ color: "#4285F4" }} />, label: "Pas / jour", val: data.activity.avgSteps ? data.activity.avgSteps.toLocaleString("fr-FR") : "—", sub: `/ ${data.profile.goals.stepsGoal.toLocaleString("fr-FR")}`, color: "#4285F4", pct: data.activity.pctStepsGoal },
            { icon: <IconMoon size={13} style={{ color: "#7986CB" }} />,       label: "Sommeil",   val: fmtN(data.activity.avgSleepH, "h", 1),                                          sub: `/ ${(data.profile.goals.sleepGoalMin / 60).toFixed(1)}h`,    color: "#7986CB", pct: data.activity.pctSleepGoal },
            { icon: <IconFlame size={13} style={{ color: "#EA4335" }} />,       label: "Cal. brûlées", val: fmtN(data.activity.avgCaloriesBurned, " kcal"),                              sub: "moyenne / jour",                                             color: "#EA4335" },
            { icon: <IconBarbell size={13} style={{ color: "#34A853" }} />,    label: "Séances",   val: String(data.activity.totalSessions),                                            sub: "sur la période",                                             color: "#34A853" },
          ].map(({ icon, label, val, sub, color, pct }) => (
            <KpiCard key={label} icon={icon} label={label} value={val} sub={sub} color={color} pct={pct} />
          ))}
        </div>

        {/* Steps trend */}
        {data.activity.daily.filter(d => d.steps !== null).length > 1 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Évolution des pas</p>
            <div className="rounded-xl overflow-hidden" style={{ height: 60, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <MiniBarChart
                data={(data.activity.daily as DayActivity[]).map(d => ({ val: d.steps, label: d.date }))}
                color="#4285F4"
                height={60}
                maxOverride={Math.max(data.profile.goals.stepsGoal * 1.3, ...data.activity.daily.map((d: DayActivity) => d.steps ?? 0))}
              />
            </div>
          </div>
        )}

        {/* Sleep trend */}
        {data.activity.daily.filter(d => d.sleepMin !== null).length > 1 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Évolution du sommeil</p>
            <div className="rounded-xl overflow-hidden" style={{ height: 50, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <MiniBarChart
                data={(data.activity.daily as DayActivity[]).map(d => ({ val: d.sleepMin ? d.sleepMin / 60 : null, label: d.date }))}
                color="#7986CB"
                height={50}
                maxOverride={12}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{fmtDate(data.meta.from)}</span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{fmtDate(data.meta.to)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MICRONUTRIMENTS & SUPPLÉMENTS
      ═══════════════════════════════════════════════════════════ */}
      <div className="glass p-5 mb-5 report-page-break">
        <SectionTitle icon="💊" title="Micronutriments & Suppléments" color="#a78bfa" />

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Observance globale", val: `${data.supplements.overallAdherencePct}%`, color: score(data.supplements.overallAdherencePct).color },
            { label: "Produits suivis",     val: String(data.supplements.productsCount),      color: "#a78bfa" },
            { label: "Prises enregistrées", val: String(data.supplements.totalIntakes),        color: "#a78bfa" },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex flex-col items-center gap-1 py-3 rounded-xl"
              style={{ background: `${color}14`, border: `1px solid ${color}40` }}>
              <p className="text-[9px] font-medium uppercase tracking-wider text-center px-1" style={{ color }}>{label}</p>
              <p className="text-[16px] font-bold" style={{ color }}>{val}</p>
            </div>
          ))}
        </div>

        {/* Adherence table */}
        {data.supplements.perProduct.length > 0 && (
          <div className="rounded-xl overflow-hidden mb-5" style={{ border: "1px solid var(--border)" }}>
            <div className="px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Observance par complément
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {data.supplements.perProduct.map(row => {
                const FREQ_LABEL: Record<string, string> = { once: "1×/j", twice: "2×/j", thrice: "3×/j", four_times: "4×/j" };
                const s = score(row.adherencePct);
                return (
                  <div key={row.id} className="flex items-center justify-between px-3 py-2.5 report-card">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{row.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {FREQ_LABEL[row.frequency] ?? row.frequency} · {row.actualTotal}/{row.expectedTotal} prises · {row.daysMissed} j manqué{row.daysMissed > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-[12px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {row.adherencePct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Micronutrient status table */}
        {data.micronutrients.perNutrient.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Apports micronutriments (suppléments) vs AJR
              </p>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {data.micronutrients.daysLogged} jours suivis
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {data.micronutrients.perNutrient.map(n => {
                const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
                  carence: { label: "Carence",  color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
                  ok:      { label: "OK",       color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)" },
                  exces:   { label: "Excès",    color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)" },
                  inconnu: { label: "—",        color: "var(--text-muted)", bg: "rgba(255,255,255,0.03)", border: "var(--border)" },
                };
                const cfg = STATUS_CFG[n.status];
                return (
                  <div key={n.code} className="flex items-center justify-between px-3 py-2 report-card">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{n.label}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {n.avgPerDay}{n.unit}/j moy. {n.rda ? `· AJR ${n.rda}${n.unit}` : ""} {n.pctRda !== null ? `· ${n.pctRda}% AJR` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data.supplements.perProduct.length === 0 && data.micronutrients.perNutrient.length === 0 && (
          <p className="text-[11px] text-center py-4" style={{ color: "var(--text-muted)" }}>
            Aucune donnée de supplément ou micronutriment sur cette période.
          </p>
        )}

        {data.micronutrients.deficiencies.length > 0 && (
          <div className="mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)" }}>
            <IconAlertCircle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
            <p className="text-[11px] leading-relaxed" style={{ color: "#f87171" }}>
              Carences potentielles détectées sur : {data.micronutrients.deficiencies.map(d => d.label).join(", ")}.
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SANTÉ & VITAUX
      ═══════════════════════════════════════════════════════════ */}
      <div className="glass p-5 mb-5">
        <SectionTitle icon="❤️" title="Santé & Constantes vitales" color="#EA4335" />

        {/* Weight */}
        {(data.health.weightStart || data.health.weightEnd) && (
          <div className="glass p-4 mb-4 rounded-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              ⚖️ Évolution du poids
            </p>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Début</p>
                <p className="text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>
                  {fmtN(data.health.weightStart, " kg", 1)}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 px-4">
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                {data.health.weightDelta !== null && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full"
                    style={{
                      background: data.health.weightDelta < 0 ? "rgba(52,211,153,0.1)" : data.health.weightDelta > 0 ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${data.health.weightDelta < 0 ? "rgba(52,211,153,0.3)" : data.health.weightDelta > 0 ? "rgba(248,113,113,0.3)" : "var(--border)"}`,
                    }}>
                    {data.health.weightDelta < 0 ? <IconArrowDown size={11} style={{ color: "#34d399" }} /> :
                     data.health.weightDelta > 0 ? <IconArrowUp size={11} style={{ color: "#f87171" }} /> :
                     <IconMinus size={11} style={{ color: "var(--text-muted)" }} />}
                    <span className="text-[11px] font-semibold"
                      style={{ color: data.health.weightDelta < 0 ? "#34d399" : data.health.weightDelta > 0 ? "#f87171" : "var(--text-muted)" }}>
                      {data.health.weightDelta > 0 ? "+" : ""}{data.health.weightDelta} kg
                    </span>
                  </div>
                )}
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>
              <div className="text-center">
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Fin</p>
                <p className="text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>
                  {fmtN(data.health.weightEnd, " kg", 1)}
                </p>
              </div>
            </div>
            {data.profile.goals.targetWeightKg && (
              <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Objectif</span>
                <span className="text-[12px] font-semibold" style={{ color: "#f472b6" }}>
                  {data.profile.goals.targetWeightKg} kg
                  {data.health.weightEnd && (
                    <span className="text-[10px] font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>
                      (encore {Math.abs(Math.round((data.health.weightEnd - data.profile.goals.targetWeightKg) * 10) / 10)} kg)
                    </span>
                  )}
                </span>
              </div>
            )}
            {data.health.bodyFatEnd && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>% masse grasse</span>
                <span className="text-[12px] font-semibold" style={{ color: "#fb923c" }}>{data.health.bodyFatEnd}%</span>
              </div>
            )}
          </div>
        )}

        {/* Vitals grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { icon: "❤️", label: "FC moyenne",   val: fmtN(data.health.avgHR, " bpm"),   color: "#EA4335" },
            { icon: "🩸", label: "Tension moy",  val: data.health.avgSys ? `${data.health.avgSys}/${data.health.avgDia}` : "—", unit: "mmHg", color: "#f87171" },
            { icon: "💨", label: "SpO₂",         val: fmtN(data.health.latestSpO2, "%"),  color: "#60a5fa" },
          ].filter(v => v.val !== "—").map(({ icon, label, val, unit, color }) => (
            <div key={label} className="glass px-3 py-2.5 rounded-xl flex items-center gap-3">
              <span className="text-[14px]">{icon}</span>
              <div>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-[15px] font-bold" style={{ color }}>
                  {val}{unit && <span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Symptoms summary */}
        {data.health.symptomsTotal > 0 && (
          <div className="rounded-xl overflow-hidden mb-3" style={{ border: "1px solid var(--border)" }}>
            <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                🩺 Symptômes enregistrés
              </p>
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }}>
                {data.health.symptomsTotal} occurrences
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {data.health.topSymptoms.map(s => (
                <div key={s.name} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.category}</p>
                  </div>
                  <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(251,146,60,0.08)", color: "#fb923c" }}>
                    ×{s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medications */}
        {data.health.medicationsTotal > 0 && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(192,132,252,0.07)", border: "1px solid rgba(192,132,252,0.2)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[14px]">💊</span>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Médicaments enregistrés</p>
            </div>
            <p className="text-[13px] font-semibold" style={{ color: "#c084fc" }}>{data.health.medicationsTotal} prises</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          HISTORIQUE DES SYMPTÔMES
      ═══════════════════════════════════════════════════════════ */}
      {data.health.symptomHistory.length > 0 && (
        <div className="glass p-5 mb-5 report-page-break">
          <SectionTitle icon="🩺" title="Historique des symptômes" color="#fb923c" />

          <div className="space-y-4">
            {data.health.symptomHistory.map(day => {
              const SCAT_COLOR: Record<string, string> = {
                douleur: "#f87171", digestif: "#fb923c", respiratoire: "#60a5fa",
                general: "#fbbf24", neurologique: "#a78bfa", cutane: "#34d399",
              };
              const SCAT_ICON: Record<string, string> = {
                douleur: "🤕", digestif: "🫃", respiratoire: "🫁",
                general: "🌡️", neurologique: "🧠", cutane: "🩹",
              };
              const SEV_COLOR: Record<string, string> = {
                "léger": "#34d399", "modéré": "#fbbf24", "sévère": "#f87171",
              };
              const ALERT_CFG: Record<string, { color: string; dot: string }> = {
                vert:   { color: "#34d399", dot: "🟢" },
                orange: { color: "#fbbf24", dot: "🟡" },
                rouge:  { color: "#f87171", dot: "🔴" },
              };
              return (
                <div key={day.date} className="report-card">
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#fb923c" }} />
                    <p className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                      {dateFnsFormat(parseISO(day.date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: fr })}
                    </p>
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {day.symptoms.length} symptôme{day.symptoms.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Symptom chips */}
                  <div className="flex flex-wrap gap-1.5 pl-3.5 mb-2">
                    {day.symptoms.map((s, i) => {
                      const catColor = SCAT_COLOR[s.category] ?? "#fb923c";
                      const sevColor = s.severity ? (SEV_COLOR[s.severity] ?? catColor) : catColor;
                      return (
                        <span key={i}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: `${sevColor}14`, border: `1px solid ${sevColor}44`, color: sevColor }}>
                          <span>{SCAT_ICON[s.category] ?? "🩺"}</span>
                          {s.name}
                          {s.severity && <span style={{ opacity: 0.7 }}>· {s.severity}</span>}
                          {s.time && <span style={{ opacity: 0.5 }}>· {s.time}</span>}
                        </span>
                      );
                    })}
                  </div>

                  {/* AI synthesis badge */}
                  {day.synthesis && (() => {
                    const cfg = ALERT_CFG[day.synthesis.alertLevel] ?? ALERT_CFG.vert;
                    return (
                      <div className="flex items-start gap-2 pl-3.5 py-1.5 rounded-lg"
                        style={{ background: `${cfg.color}0d`, border: `1px solid ${cfg.color}30` }}>
                        <span className="text-[11px] flex-shrink-0">{cfg.dot}</span>
                        <div>
                          <p className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                            Nutri-IA-Med · {day.synthesis.alertLabel}
                          </p>
                          <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                            {day.synthesis.summary}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SCAN VISAGE
      ═══════════════════════════════════════════════════════════ */}
      {data.faceScan.scansCount > 0 && (
        <div className="glass p-5 mb-5 report-page-break">
          <SectionTitle icon="🔎" title="Scan Visage — indicateurs visuels" color="#f472b6" />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="glass p-3 rounded-xl">
              <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Nombre de scans</p>
              <p className="text-[16px] font-bold" style={{ color: "#f472b6" }}>{data.faceScan.scansCount}</p>
            </div>
            <div className="glass p-3 rounded-xl">
              <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Période</p>
              <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {data.faceScan.first ? fmtDate(data.faceScan.first.date) : "—"} → {data.faceScan.latest ? fmtDate(data.faceScan.latest.date) : "—"}
              </p>
            </div>
          </div>

          {/* Delta first vs latest */}
          {data.faceScan.delta && (
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid rgba(244,114,182,0.25)" }}>
              <div className="px-3 py-2" style={{ background: "rgba(244,114,182,0.08)", borderBottom: "1px solid rgba(244,114,182,0.15)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#f472b6" }}>
                  Évolution 1ᵉʳ scan → dernier scan
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "rgba(244,114,182,0.15)" }}>
                {Object.entries(data.faceScan.delta).map(([axis, delta]) => (
                  <div key={axis} className="flex items-center justify-between px-3 py-2">
                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{AXIS_LABEL[axis] ?? axis}</span>
                    <div className="flex items-center gap-1.5">
                      {delta < 0 ? <IconArrowDown size={11} style={{ color: "#34d399" }} /> :
                       delta > 0 ? <IconArrowUp size={11} style={{ color: "#f87171" }} /> :
                       <IconMinus size={11} style={{ color: "var(--text-muted)" }} />}
                      <span className="text-[11px] font-semibold"
                        style={{ color: delta < 0 ? "#34d399" : delta > 0 ? "#f87171" : "var(--text-muted)" }}>
                        {delta > 0 ? "+" : ""}{delta} / 5
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full history table */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Historique des scores (échelle 1-5, indicatif)
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {data.faceScan.entries.map(e => (
                <div key={e.date} className="px-3 py-2 report-card">
                  <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{fmtDate(e.date)}</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Object.entries(e.scorecard).map(([axis, val]) => (
                      <div key={axis} className="text-center px-1.5 py-1 rounded-lg" style={{ background: "rgba(244,114,182,0.06)" }}>
                        <p className="text-[8px] uppercase tracking-wide truncate" style={{ color: "var(--text-muted)" }}>{AXIS_LABEL[axis] ?? axis}</p>
                        <p className="text-[13px] font-bold" style={{ color: "#f472b6" }}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[9px] mt-3 leading-relaxed" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
            Scores visuels indicatifs (1-5) issus d&apos;une analyse par IA de photos, non diagnostiques. Ne remplacent pas un examen clinique.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SYNTHÈSE IA (dernière disponible)
      ═══════════════════════════════════════════════════════════ */}
      {data.latestSynthesis && (() => {
        const s = data.latestSynthesis;
        const ALERT_CFG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
          vert:   { color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.3)",  dot: "🟢" },
          orange: { color: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.3)",  dot: "🟡" },
          rouge:  { color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.3)", dot: "🔴" },
        };
        const cfg = ALERT_CFG[s.alertLevel] ?? ALERT_CFG.vert;
        return (
          <div className="glass p-5 mb-5">
            <SectionTitle icon="🤖" title="Synthèse Nutri-IA-Med" color="#a78bfa" />

            {/* Alert badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <span className="text-[14px]">{cfg.dot}</span>
              <span className="text-[13px] font-semibold" style={{ color: cfg.color }}>{s.alertLabel}</span>
              {s.generatedAt && (
                <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {dateFnsFormat(new Date(s.generatedAt), "d MMM yyyy", { locale: fr })}
                </span>
              )}
            </div>

            <p className="text-[12px] leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
              {s.summary}
            </p>

            {/* Sections */}
            <div className="space-y-2 mb-4">
              {[
                { icon: "❤️", label: "Constantes",  text: s.vitaux,    show: true },
                { icon: "🩺", label: "Symptômes",   text: s.symptomes, show: !!s.symptomes },
                { icon: "🥗", label: "Nutrition",   text: s.nutrition, show: true },
                { icon: "🏃", label: "Activité",    text: s.activite,  show: !!s.activite },
              ].filter(sec => sec.show).map(({ icon, label, text }) => (
                <div key={label}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
                  <span className="text-[13px] flex-shrink-0 mt-0.5">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {s.recommandations?.length > 0 && (
              <div className="rounded-xl overflow-hidden mb-3" style={{ border: "1px solid rgba(167,139,250,0.25)" }}>
                <div className="px-3 py-2" style={{ background: "rgba(167,139,250,0.08)", borderBottom: "1px solid rgba(167,139,250,0.15)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#a78bfa" }}>
                    💡 Recommandations
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(167,139,250,0.15)" }}>
                  {s.recommandations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                      <span className="text-[11px] font-bold flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }}>{i + 1}</span>
                      <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {s.consulter && (
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)" }}>
                <IconAlertCircle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                <p className="text-[12px] leading-relaxed" style={{ color: "#f87171" }}>{s.consulter}</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════ */}
      <div className="text-center py-6 space-y-1">
        <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>NutriTracker · Rapport personnel de santé</p>
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Généré le {format(new Date(data.meta.generatedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })} · Données confidentielles
        </p>
        <p className="text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
          Ce rapport est indicatif et ne remplace pas un avis médical professionnel.
        </p>
      </div>
    </div>
  );
}
