"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconPlus, IconLoader2, IconTrash, IconClock } from "@tabler/icons-react";
import { format } from "date-fns";
import type { SupplementProduct, SupplementLog } from "@/app/lib/types";

interface SupplementLoggerProps {
  date: string; // "YYYY-MM-DD"
}

export default function SupplementLogger({ date }: SupplementLoggerProps) {
  const [products, setProducts] = useState<SupplementProduct[]>([]);
  const [log, setLog] = useState<SupplementLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    supplementId: "",
    supplementName: "",
    time: format(new Date(), "HH:mm"),
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, logRes] = await Promise.all([
        fetch("/api/supplements"),
        fetch(`/api/supplement-intakes?date=${date}`),
      ]);
      const productsData = await productsRes.json();
      const logData = await logRes.json();
      setProducts(productsData.products || []);
      setLog(logData.log);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplementId || !form.time) return;

    setLoading(true);
    try {
      const res = await fetch("/api/supplement-intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          supplementId: form.supplementId,
          supplementName: form.supplementName,
          time: form.time,
          notes: form.notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLog(data.log);
        setForm({
          supplementId: "",
          supplementName: "",
          time: format(new Date(), "HH:mm"),
          notes: "",
        });
        setShowForm(false);
      }
    } catch (e) {
      console.error("Failed to log intake:", e);
    } finally {
      setLoading(false);
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
      }
    } catch (e) {
      console.error("Failed to delete intake:", e);
    }
  };

  const sortedIntakes = log?.intakes?.sort((a, b) => a.time.localeCompare(b.time)) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Suppléments & Compléments
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95"
          style={{
            background: "rgba(52,211,153,0.12)",
            border: "1px solid rgba(52,211,153,0.3)",
            color: "var(--text-primary)",
          }}
        >
          <IconPlus size={14} />
          Ajouter prise
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl p-4 overflow-hidden"
            style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
          >
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  Supplément *
                </label>
                <select
                  value={form.supplementId}
                  onChange={e => handleSelectProduct(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-[12px]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">Sélectionner un supplément</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  Heure de prise *
                </label>
                <div className="flex items-center gap-2">
                  <IconClock size={14} style={{ color: "var(--text-muted)" }} />
                  <input
                    type="time"
                    value={form.time}
                    onChange={e => setForm({ ...form, time: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg text-[12px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  Notes
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ex: Avec nourriture, avec jus d'orange"
                  className="w-full px-3 py-2 rounded-lg text-[12px]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading || !form.supplementId}
                  className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: "rgba(52,211,153,0.12)",
                    border: "1px solid rgba(52,211,153,0.3)",
                    color: "var(--text-primary)",
                  }}
                >
                  {loading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />}
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Annuler
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="space-y-2">
        {sortedIntakes.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Aucune prise enregistrée pour aujourd'hui
          </p>
        ) : (
          sortedIntakes.map(intake => (
            <motion.div
              key={intake.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-lg p-3 flex items-start justify-between"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {intake.supplementName}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: "rgba(99,102,241,0.15)", color: "var(--indigo)" }}>
                    {intake.time}
                  </span>
                </div>
                {intake.notes && (
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {intake.notes}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(intake.id)}
                className="flex-shrink-0 p-1.5 rounded-lg ml-2 transition-all hover:opacity-70"
                style={{ background: "rgba(239,68,68,0.1)" }}
              >
                <IconTrash size={14} style={{ color: "var(--error)" }} />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
