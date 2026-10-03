"use client";

import { useState, useEffect } from "react";
import { IconPlus, IconLoader2, IconTrash, IconClock, IconCheck } from "@tabler/icons-react";
import Sheet from "./Sheet";
import { format, subDays } from "date-fns";
import type { SupplementProduct, SupplementLog, SupplementIntake, SupplementMoment } from "@/app/lib/types";

interface SupplementLoggerProps {
  date: string; // "YYYY-MM-DD"
  onIntakeLogged?: () => void; // called after a supplement (and its micronutrients) is logged
}

const MOMENTS: { value: SupplementMoment; label: string; hour: number }[] = [
  { value: "morning",     label: "Matin",              hour: 8  },
  { value: "mid_morning", label: "Milieu de matinée",  hour: 10 },
  { value: "noon",        label: "Midi",               hour: 12 },
  { value: "afternoon",   label: "Après-midi",         hour: 16 },
  { value: "evening",     label: "Soir",               hour: 20 },
];

const MOMENT_LABEL: Record<SupplementMoment, string> = Object.fromEntries(
  MOMENTS.map(m => [m.value, m.label])
) as Record<SupplementMoment, string>;

function guessMoment(hour: number): SupplementMoment {
  if (hour < 10) return "morning";
  if (hour < 12) return "mid_morning";
  if (hour < 14) return "noon";
  if (hour < 18) return "afternoon";
  return "evening";
}

export default function SupplementLogger({ date, onIntakeLogged }: SupplementLoggerProps) {
  const [products, setProducts] = useState<SupplementProduct[]>([]);
  const [log, setLog] = useState<SupplementLog | null>(null);
  const [yesterdayIntakes, setYesterdayIntakes] = useState<SupplementIntake[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickAdding, setQuickAdding] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingIntakeId, setEditingIntakeId] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplementId: "",
    supplementName: "",
    time: format(new Date(), "HH:mm"),
    moment: guessMoment(new Date().getHours()) as SupplementMoment,
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const yesterday = format(subDays(new Date(date), 1), "yyyy-MM-dd");
      const [productsRes, logRes, yesterdayRes] = await Promise.all([
        fetch("/api/supplements", { cache: "no-store" }),
        fetch(`/api/supplement-intakes?date=${date}`, { cache: "no-store" }),
        fetch(`/api/supplement-intakes?date=${yesterday}`, { cache: "no-store" }),
      ]);
      const productsData = await productsRes.json();
      const logData = await logRes.json();
      const yesterdayData = await yesterdayRes.json();
      setProducts(productsData.products || []);
      setLog(logData.log);
      setYesterdayIntakes(yesterdayData.log?.intakes || []);
    } catch (e) {
      console.error("Failed to fetch data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setForm(prev => ({
        ...prev,
        supplementId: productId,
        supplementName: product.name,
      }));
    }
  };

  const resetForm = () => {
    setForm({
      supplementId: "",
      supplementName: "",
      time: format(new Date(), "HH:mm"),
      moment: guessMoment(new Date().getHours()),
      notes: "",
    });
    setEditingIntakeId(null);
    setShowForm(false);
  };

  const handleEditIntake = (intake: SupplementIntake) => {
    setForm({
      supplementId: intake.supplementId,
      supplementName: intake.supplementName,
      time: intake.time,
      moment: intake.moment ?? guessMoment(parseInt(intake.time.split(":")[0] || "0", 10)),
      notes: intake.notes ?? "",
    });
    setEditingIntakeId(intake.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplementId || !form.time) return;

    setLoading(true);
    try {
      if (editingIntakeId) {
        // Editing only touches the intake's schedule (time/moment/notes) — the
        // micronutrients logged when it was first added are left untouched.
        const res = await fetch("/api/supplement-intakes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            intakeId: editingIntakeId,
            time: form.time,
            moment: form.moment,
            notes: form.notes,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setLog(data.log);
          resetForm();
        } else {
          alert("La modification a échoué. Réessaie.");
        }
        return;
      }

      const res = await fetch("/api/supplement-intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          supplementId: form.supplementId,
          supplementName: form.supplementName,
          time: form.time,
          moment: form.moment,
          notes: form.notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLog(data.log);

        // Also log micronutrients if the supplement has them
        const product = products.find(p => p.id === form.supplementId);
        if (product?.micronutrients?.length) {
          await Promise.all(product.micronutrients.map(micronutrient =>
            fetch("/api/micronutrient-intakes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date,
                code: micronutrient.code,
                amount: micronutrient.amount,
                unit: micronutrient.unit,
                source: form.supplementName,
                time: form.time,
              }),
            }).catch(err => console.warn("[micronutrient-intakes]", err))
          ));
        }
        onIntakeLogged?.();
        resetForm();
      }
    } catch (e) {
      console.error("Failed to log intake:", e);
    } finally {
      setLoading(false);
    }
  };

  const quickAddFromYesterday = async (intake: SupplementIntake) => {
    const key = `${intake.supplementId}-${intake.moment ?? intake.time}`;
    setQuickAdding(key);
    try {
      const now = new Date();
      const time = format(now, "HH:mm");
      const res = await fetch("/api/supplement-intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          supplementId: intake.supplementId,
          supplementName: intake.supplementName,
          time,
          moment: intake.moment ?? guessMoment(now.getHours()),
          notes: intake.notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLog(data.log);

        const product = products.find(p => p.id === intake.supplementId);
        if (product?.micronutrients?.length) {
          await Promise.all(product.micronutrients.map(micronutrient =>
            fetch("/api/micronutrient-intakes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date,
                code: micronutrient.code,
                amount: micronutrient.amount,
                unit: micronutrient.unit,
                source: intake.supplementName,
                time,
              }),
            }).catch(err => console.warn("[micronutrient-intakes]", err))
          ));
        }
        onIntakeLogged?.();
      }
    } catch (e) {
      console.error("Failed to quick-add intake:", e);
    } finally {
      setQuickAdding(null);
    }
  };

  const handleDelete = async (intakeId: string) => {
    if (!confirm("Supprimer cette prise ?")) return;
    try {
      const res = await fetch(`/api/supplement-intakes?date=${date}&intakeId=${intakeId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setLog(data.log);
        if (editingIntakeId === intakeId) resetForm();
      }
    } catch (e) {
      console.error("Failed to delete intake:", e);
    }
  };

  const sortedIntakes = [...(log?.intakes ?? [])].sort((a, b) => a.time.localeCompare(b.time));
  const activeProducts = products.filter(p => p.active !== false);

  // Suggestions "comme hier" : prises d'hier pas encore faites aujourd'hui, hors complements en pause (cure terminee).
  const todayKeys = new Set(sortedIntakes.map(i => `${i.supplementId}-${i.moment ?? ""}`));
  const activeProductIds = new Set(activeProducts.map(p => p.id));
  const yesterdaySuggestions = Array.from(
    new Map(
      yesterdayIntakes.map(i => [`${i.supplementId}-${i.moment ?? i.time}`, i])
    ).values()
  ).filter(i => !todayKeys.has(`${i.supplementId}-${i.moment ?? ""}`) && activeProductIds.has(i.supplementId));

  const chip = "inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full text-[13px] font-medium transition-transform active:scale-95 disabled:opacity-60";
  const isEditing = editingIntakeId !== null;
  const nothing = sortedIntakes.length === 0 && yesterdaySuggestions.length === 0;

  return (
    <section aria-label="Compléments" className="mb-4">
      {/* En-tete a plat : pas de carte, pas de cadre */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
          Compléments{sortedIntakes.length > 0 && <span style={{ color: "var(--fiber)" }}> · {sortedIntakes.length} pris</span>}
        </p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          aria-label="Ajouter une prise"
          className="flex items-center gap-1 min-h-[44px] pl-3 -mr-2 pr-2 text-[13px] font-medium active:scale-95 transition-transform"
          style={{ color: "var(--fiber)" }}
        >
          <IconPlus size={16} stroke={2.2} /> Ajouter
        </button>
      </div>

      {nothing ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          {loading ? "Chargement…" : products.length === 0 ? "Aucun complément configuré (Réglages)." : "Aucune prise aujourd'hui."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {/* Pris aujourd'hui : touche = modifier ou supprimer */}
          {sortedIntakes.map(intake => (
            <button
              key={intake.id}
              type="button"
              onClick={() => handleEditIntake(intake)}
              className={chip}
              style={{ background: "color-mix(in srgb, var(--fiber) 16%, transparent)", color: "var(--fiber)" }}
              aria-label={`${intake.supplementName}, pris à ${intake.time}. Modifier`}
            >
              <IconCheck size={14} stroke={2.6} />
              {intake.supplementName}
              <span className="font-normal tabular-nums" style={{ opacity: 0.75 }}>{intake.time}</span>
            </button>
          ))}
          {/* Pas encore pris (comme hier) : touche = enregistrer maintenant */}
          {yesterdaySuggestions.map(intake => {
            const key = `${intake.supplementId}-${intake.moment ?? intake.time}`;
            const isAdding = quickAdding === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => quickAddFromYesterday(intake)}
                disabled={isAdding}
                className={chip}
                style={{ background: "var(--layer-1)", color: "var(--text-secondary)" }}
                aria-label={`Enregistrer ${intake.supplementName} maintenant`}
              >
                {isAdding ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} stroke={2.2} />}
                {intake.supplementName}
                {intake.moment && <span className="font-normal" style={{ color: "var(--text-muted)" }}>{MOMENT_LABEL[intake.moment]}</span>}
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={showForm} onClose={resetForm} title={isEditing ? "Modifier la prise" : "Ajouter une prise"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="supp-product" className="text-[12px] font-medium block mb-1.5" style={{ color: "var(--text-muted)" }}>Complément</label>
            <select
              id="supp-product"
              value={form.supplementId}
              onChange={e => handleSelectProduct(e.target.value)}
              disabled={isEditing}
              className="input disabled:opacity-60"
              style={{ height: 44 }}
            >
              <option value="">Sélectionner un complément</option>
              {(isEditing && !activeProducts.some(p => p.id === form.supplementId)
                ? [...activeProducts, ...products.filter(p => p.id === form.supplementId)]
                : activeProducts
              ).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="supp-time" className="text-[12px] font-medium block mb-1.5" style={{ color: "var(--text-muted)" }}>Heure de prise</label>
            <div className="flex items-center gap-2">
              <IconClock size={16} style={{ color: "var(--text-muted)" }} />
              <input
                id="supp-time"
                type="time"
                value={form.time}
                onChange={e => {
                  const time = e.target.value;
                  const hour = parseInt(time.split(":")[0] || "0", 10);
                  setForm(prev => ({ ...prev, time, moment: guessMoment(hour) }));
                }}
                className="input flex-1"
                style={{ height: 44 }}
              />
            </div>
          </div>

          <div>
            <p className="text-[12px] font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Moment de la journée</p>
            <div className="flex flex-wrap gap-2">
              {MOMENTS.map(m => {
                const selected = form.moment === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, moment: m.value }))}
                    aria-pressed={selected}
                    className="min-h-[40px] px-3.5 rounded-full text-[13px] font-medium transition-colors"
                    style={{
                      background: selected ? "color-mix(in srgb, var(--fiber) 18%, transparent)" : "var(--layer-1)",
                      color: selected ? "var(--fiber)" : "var(--text-secondary)",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="supp-notes" className="text-[12px] font-medium block mb-1.5" style={{ color: "var(--text-muted)" }}>Notes</label>
            <input
              id="supp-notes"
              type="text"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex : avec nourriture, avec jus d'orange"
              className="input"
              style={{ height: 44 }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !form.supplementId}
            className="btn btn-primary w-full gap-2 disabled:opacity-50"
            style={{ height: 48 }}
          >
            {loading ? <IconLoader2 size={16} className="animate-spin" /> : <IconCheck size={16} stroke={2.4} />}
            {isEditing ? "Enregistrer" : "Ajouter"}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={() => editingIntakeId && handleDelete(editingIntakeId)}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl text-[13px] font-medium"
              style={{ color: "var(--danger)" }}
            >
              <IconTrash size={16} /> Supprimer cette prise
            </button>
          )}
        </form>
      </Sheet>
    </section>
  );
}
