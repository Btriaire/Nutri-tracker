"use client"
import { useState } from "react";
import Sheet from "@/app/components/Sheet";
import DayPlanEditor from "@/app/components/DayPlanEditor";
import { planPeriod, datesBetween, ECART_KCAL, KCAL_PER_DRINK, MAX_PERIOD_DAYS, type PeriodParams, type DayPlan, type PeriodQuality, type EcartType, type EcartSize } from "@/app/lib/period-plan";

export default function PeriodModal({ from, to, open, onClose, onSaved }: { from: string; to: string; open: boolean; onClose: () => void; onSaved: (r: { added: number; skipped: number }) => void }) {
  const [step, setStep] = useState(1);
  const [params, setParams] = useState<PeriodParams>({
    from,
    to,
    kcal: 2000,
    quality: "mixed",
    ecartsPerWeek: 1,
    ecartType: "repas",
    ecartSize: "moyen",
    drinksPerWeek: 0,
    activity: "normale",
    feeling: { energy: 3, mood: 3, sleep: 3 },
    note: ""
  });
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [futureDatesIgnored, setFutureDatesIgnored] = useState(false);

  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dates = datesBetween(params.from, params.to);
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const isFutureDate = (date: string) => date > todayStr;
      const futureDates = dates.filter(isFutureDate);
      const validDates = dates.filter(d => !isFutureDate(d));
      setFutureDatesIgnored(futureDates.length > 0);

      const response = await fetch(`/api/log/month?from=${params.from}&to=${params.to}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Network error");
      const { days } = await response.json();
      const emptyDates = validDates.filter(d => !days[d] || days[d].status === "vide");
      const skipped = validDates.length - emptyDates.length;
      if (emptyDates.length === 0) {
        alert("Aucun jour vide dans cette période.");
        return;
      }
      setPlans(planPeriod(params, emptyDates));
      setSkippedCount(skipped);
      setStep(2);
    } catch (error) {
      alert("Calendrier indisponible, réessaie.");
    }
  };

  const handleSubmitStep2 = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, days: plans })
      });
      if (!response.ok) throw new Error("Network error");
      const result = await response.json();
      onSaved(result);
    } catch (error) {
      alert("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = (updatedPlan: DayPlan) => {
    setPlans(plans.map(p => p.date === updatedPlan.date ? updatedPlan : p));
  };

  const avg = Math.round(plans.reduce((sum, p) => sum + p.kcal + (p.ecart ? ECART_KCAL[p.ecart.type][p.ecart.size] : 0) + p.drinks * KCAL_PER_DRINK, 0) / plans.length);

  return (
    <Sheet open={open} onClose={onClose} title="Remplir une période">
      {step === 1 && (
        <form onSubmit={handleSubmitStep1} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="from" className="block text-sm font-medium text-[var(--text-primary)]">Du</label>
              <input type="date" id="from" value={params.from} onChange={(e) => setParams({ ...params, from: e.target.value })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]" required />
            </div>
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-[var(--text-primary)]">Au</label>
              <input type="date" id="to" value={params.to} onChange={(e) => setParams({ ...params, to: e.target.value })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Niveau de calories</label>
            <div className="mt-1 flex space-x-2">
              <button type="button" onClick={() => setParams({ ...params, kcal: 1600 })} className={`px-4 py-2 border-[var(--border)] rounded-md text-sm font-medium ${params.kcal === 1600 ? "bg-[var(--accent)] text-white" : "bg-[var(--layer-2)]"}`}>Léger</button>
              <button type="button" onClick={() => setParams({ ...params, kcal: 2000 })} className={`px-4 py-2 border-[var(--border)] rounded-md text-sm font-medium ${params.kcal === 2000 ? "bg-[var(--accent)] text-white" : "bg-[var(--layer-2)]"}`}>Normal</button>
              <button type="button" onClick={() => setParams({ ...params, kcal: 2500 })} className={`px-4 py-2 border-[var(--border)] rounded-md text-sm font-medium ${params.kcal === 2500 ? "bg-[var(--accent)] text-white" : "bg-[var(--layer-2)]"}`}>Copieux</button>
              <input type="number" min="1000" max="5000" step="50" value={params.kcal} onChange={(e) => setParams({ ...params, kcal: parseInt(e.target.value) })} className="flex-1 min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Qualité</label>
            <div className="mt-1 flex space-x-2">
              <button type="button" onClick={() => setParams({ ...params, quality: "balanced" })} className={`px-4 py-2 border-[var(--border)] rounded-md text-sm font-medium ${params.quality === "balanced" ? "bg-[var(--accent)] text-white" : "bg-[var(--layer-2)]"}`}>Équilibrée</button>
              <button type="button" onClick={() => setParams({ ...params, quality: "mixed" })} className={`px-4 py-2 border-[var(--border)] rounded-md text-sm font-medium ${params.quality === "mixed" ? "bg-[var(--accent)] text-white" : "bg-[var(--layer-2)]"}`}>Mixte</button>
              <button type="button" onClick={() => setParams({ ...params, quality: "unbalanced" })} className={`px-4 py-2 border-[var(--border)] rounded-md text-sm font-medium ${params.quality === "unbalanced" ? "bg-[var(--accent)] text-white" : "bg-[var(--layer-2)]"}`}>Déséquilibrée</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="ecartsPerWeek" className="block text-sm font-medium text-[var(--text-primary)]">Écarts par semaine</label>
              <input type="number" id="ecartsPerWeek" min="0" max="7" value={params.ecartsPerWeek} onChange={(e) => setParams({ ...params, ecartsPerWeek: parseInt(e.target.value) })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]" required />
            </div>
            <div>
              <label htmlFor="ecartType" className="block text-sm font-medium text-[var(--text-primary)]">Type d&apos;écart</label>
              <select id="ecartType" value={params.ecartType} onChange={(e) => setParams({ ...params, ecartType: e.target.value as EcartType })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]">
                <option value="repas">Repas copieux</option>
                <option value="sucre">Sucré</option>
                <option value="apero">Apéritif</option>
              </select>
            </div>
            <div>
              <label htmlFor="ecartSize" className="block text-sm font-medium text-[var(--text-primary)]">Taille</label>
              <select id="ecartSize" value={params.ecartSize} onChange={(e) => setParams({ ...params, ecartSize: e.target.value as EcartSize })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]">
                <option value="petit">Petit</option>
                <option value="moyen">Moyen</option>
                <option value="gros">Gros</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="drinksPerWeek" className="block text-sm font-medium text-[var(--text-primary)]">Verres d&apos;alcool par semaine</label>
            <input type="number" id="drinksPerWeek" min="0" max="40" value={params.drinksPerWeek} onChange={(e) => setParams({ ...params, drinksPerWeek: parseInt(e.target.value) })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]" required />
          </div>
          <div>
            <label htmlFor="activity" className="block text-sm font-medium text-[var(--text-primary)]">Activité</label>
            <select id="activity" value={params.activity} onChange={(e) => setParams({ ...params, activity: e.target.value as "faible" | "normale" | "elevee" })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]">
              <option value="faible">Faible</option>
              <option value="normale">Normale</option>
              <option value="elevee">Élevée</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Ressenti de la période</label>
            <div className="grid grid-cols-3 gap-4 mt-1">
              <div>
                <label htmlFor="energy" className="block text-sm font-medium text-[var(--text-primary)]">Énergie</label>
                <select id="energy" value={params.feeling.energy} onChange={(e) => setParams({ ...params, feeling: { ...params.feeling, energy: parseInt(e.target.value) } })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
              <div>
                <label htmlFor="mood" className="block text-sm font-medium text-[var(--text-primary)]">Humeur</label>
                <select id="mood" value={params.feeling.mood} onChange={(e) => setParams({ ...params, feeling: { ...params.feeling, mood: parseInt(e.target.value) } })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
              <div>
                <label htmlFor="sleep" className="block text-sm font-medium text-[var(--text-primary)]">Sommeil</label>
                <select id="sleep" value={params.feeling.sleep} onChange={(e) => setParams({ ...params, feeling: { ...params.feeling, sleep: parseInt(e.target.value) } })} className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="note" className="block text-sm font-medium text-[var(--text-primary)]">Note</label>
            <textarea id="note" maxLength={300} value={params.note} onChange={(e) => setParams({ ...params, note: e.target.value })} placeholder="vacances, beaucoup marché" className="mt-1 block w-full min-h-[44px] border-[var(--border)] rounded-md shadow-sm focus:ring-[var(--accent)] focus:border-[var(--accent)]" />
          </div>
          <button type="submit" className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)]">Proposer les jours</button>
        </form>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <p>{plans.length} jours à remplir, {skippedCount} déjà saisis laissés tels quels, moyenne {avg} kcal par jour</p>
          {futureDatesIgnored && <p className="text-[var(--text-muted)]">Les jours à venir sont ignorés.</p>}
          <p className="text-[var(--text-muted)]">Les écarts et verres proposés sont répartis automatiquement. Ils ne comptent dans les analyses (lien visage, corrélations) qu&apos;une fois le jour confirmé.</p>
          <button type="button" onClick={() => setStep(1)} className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)]">Retour</button>
          <div className="max-h-[50vh] overflow-y-auto space-y-4">
            {plans.map(p => (
              <DayPlanEditor key={p.date} plan={p} compact onChange={handlePlanChange} />
            ))}
          </div>
          <button type="button" onClick={handleSubmitStep2} disabled={saving} className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] disabled:opacity-50">Enregistrer la période</button>
        </div>
      )}
    </Sheet>
  );
}
