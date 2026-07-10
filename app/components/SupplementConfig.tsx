"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconPlus, IconLoader2, IconTrash, IconWand, IconCheck } from "@tabler/icons-react";
import type { SupplementProduct, SupplementFrequency } from "@/app/lib/types";

interface SupplementConfigProps {
  onClose?: () => void;
}

const FREQUENCIES: { value: SupplementFrequency; label: string }[] = [
  { value: "once", label: "1x par jour" },
  { value: "twice", label: "2x par jour" },
  { value: "thrice", label: "3x par jour" },
  { value: "four_times", label: "4x par jour" },
];

export default function SupplementConfig({ onClose }: SupplementConfigProps) {
  const [products, setProducts] = useState<SupplementProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    ingredients: "",
    dosagePerServing: "",
    recommendedDosage: "",
    frequency: "once" as SupplementFrequency,
    notes: "",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/supplements");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e) {
      console.error("Failed to fetch supplements:", e);
    } finally {
      setLoading(false);
    }
  };

  const generateWithAI = async () => {
    if (!form.name.trim()) return;
    setGeneratingAI(true);
    try {
      const res = await fetch("/api/supplement-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: form.name }),
      });
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        description: data.description || "",
        ingredients: (data.ingredients || []).join(", "),
        dosagePerServing: data.dosagePerServing || "",
        recommendedDosage: data.recommendedDosage || "",
      }));
    } catch (e) {
      console.error("AI generation failed:", e);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/supplements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          ingredients: form.ingredients.split(",").map(i => i.trim()).filter(Boolean),
          dosagePerServing: form.dosagePerServing,
          recommendedDosage: form.recommendedDosage,
          frequency: form.frequency,
          notes: form.notes,
        }),
      });

      if (res.ok) {
        setForm({
          name: "",
          description: "",
          ingredients: "",
          dosagePerServing: "",
          recommendedDosage: "",
          frequency: "once",
          notes: "",
        });
        setShowForm(false);
        await fetchProducts();
      }
    } catch (e) {
      console.error("Failed to create supplement:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce supplément ?")) return;
    // TODO: implement delete
    setProducts(products.filter(p => p.id !== id));
  };

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
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "var(--text-primary)",
          }}
        >
          <IconPlus size={14} />
          Ajouter
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
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  Nom du produit *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Vitamine D3, Oméga-3"
                    className="flex-1 px-3 py-2 rounded-lg text-[12px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                  <button
                    type="button"
                    onClick={generateWithAI}
                    disabled={!form.name.trim() || generatingAI}
                    className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50"
                    style={{
                      background: "rgba(251,191,36,0.12)",
                      border: "1px solid rgba(251,191,36,0.3)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {generatingAI ? <IconLoader2 size={14} className="animate-spin" /> : <IconWand size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Description du produit et ses bénéfices"
                  className="w-full px-3 py-2 rounded-lg text-[12px] h-16 resize-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                    Ingrédients (séparés par virgule)
                  </label>
                  <input
                    type="text"
                    value={form.ingredients}
                    onChange={e => setForm({ ...form, ingredients: e.target.value })}
                    placeholder="Ex: Cholécalciférol, huile de coco"
                    className="w-full px-3 py-2 rounded-lg text-[12px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                    Dosage par prise
                  </label>
                  <input
                    type="text"
                    value={form.dosagePerServing}
                    onChange={e => setForm({ ...form, dosagePerServing: e.target.value })}
                    placeholder="Ex: 1000 IU, 500mg"
                    className="w-full px-3 py-2 rounded-lg text-[12px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                    Posologie recommandée *
                  </label>
                  <input
                    type="text"
                    value={form.recommendedDosage}
                    onChange={e => setForm({ ...form, recommendedDosage: e.target.value })}
                    placeholder="Ex: 1 comprimé par jour"
                    className="w-full px-3 py-2 rounded-lg text-[12px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                    Cadence quotidienne *
                  </label>
                  <select
                    value={form.frequency}
                    onChange={e => setForm({ ...form, frequency: e.target.value as SupplementFrequency })}
                    className="w-full px-3 py-2 rounded-lg text-[12px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    {FREQUENCIES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
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
                  placeholder="Notes personnelles (optionnel)"
                  className="w-full px-3 py-2 rounded-lg text-[12px]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading || !form.name.trim() || !form.recommendedDosage.trim()}
                  className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: "rgba(52,211,153,0.12)",
                    border: "1px solid rgba(52,211,153,0.3)",
                    color: "var(--text-primary)",
                  }}
                >
                  {loading ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
                  Ajouter
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
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {products.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Aucun supplément configuré
          </p>
        ) : (
          products.map(product => (
            <div
              key={product.id}
              className="rounded-lg p-3 flex items-start justify-between"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {product.name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.15)", color: "var(--indigo)" }}>
                    {FREQUENCIES.find(f => f.value === product.frequency)?.label}
                  </span>
                </div>
                {product.description && (
                  <p className="text-[11px] mt-1 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                    {product.description}
                  </p>
                )}
                {product.recommendedDosage && (
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {product.recommendedDosage}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(product.id)}
                className="flex-shrink-0 p-1.5 rounded-lg ml-2 transition-all hover:opacity-70"
                style={{ background: "rgba(239,68,68,0.1)" }}
              >
                <IconTrash size={14} style={{ color: "var(--error)" }} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
