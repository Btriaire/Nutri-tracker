"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { EnvelopeSimple, Lock, ArrowRight, Spinner } from "@phosphor-icons/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);

    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bypass: { email, pass } }),
    });

    setLoading(false);
    if (res.ok) router.push("/log");
    else setError("Identifiants incorrects");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background effects */}
      <div className="bg-orbs" />
      <div className="bg-grid" />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[360px]"
      >
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(139,92,246,0.2))",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <span className="text-lg">🥗</span>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            NutriTracker
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            Connectez-vous à votre espace personnel
          </p>
        </div>

        {/* Glass card */}
        <div className="glass-strong p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div>
              <label className="label-xs block mb-1.5">E-mail</label>
              <div className="relative">
                <EnvelopeSimple
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="vous@exemple.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label-xs block mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="input pl-9"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[12px] text-red-400 flex items-center gap-1.5"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-1"
              style={{ height: "38px" }}
            >
              {loading ? (
                <Spinner size={14} className="animate-spin" />
              ) : (
                <>
                  Connexion
                  <ArrowRight size={13} weight="bold" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] mt-4" style={{ color: "var(--text-muted)" }}>
          Accès privé · Données stockées dans votre Firestore
        </p>
      </motion.div>
    </div>
  );
}
