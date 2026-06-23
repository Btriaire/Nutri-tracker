"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IconMail, IconLock, IconChevronRight, IconLoader2 } from "@tabler/icons-react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getClientAuth } from "@/app/lib/firebase-client";
import AnimatedLogo from "@/app/components/AnimatedLogo";

async function createServerSession(body: object): Promise<boolean> {
  const res = await fetch("/api/auth/session", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  return res.ok;
}

export default function LoginPage() {
  const router = useRouter();
  const [email,       setEmail]       = useState("");
  const [pass,        setPass]        = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [googleLoad,  setGoogleLoad]  = useState(false);

  const redirect = () => router.push("/hub");

  // ── Email / password ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const ok = await createServerSession({ bypass: { email, pass } });
    setLoading(false);
    if (ok) redirect();
    else setError("Identifiants incorrects");
  };

  // ── Google Sign-In ───────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError(""); setGoogleLoad(true);
    try {
      const auth     = getClientAuth();
      const provider = new GoogleAuthProvider();
      const cred     = await signInWithPopup(auth, provider);
      const idToken  = await cred.user.getIdToken();
      const ok       = await createServerSession({ idToken });
      if (ok) redirect();
      else setError("Compte non autorisé");
    } catch (err: unknown) {
      const msg = (err as { code?: string }).code;
      if (msg !== "auth/popup-closed-by-user") setError("Connexion Google échouée");
    } finally {
      setGoogleLoad(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="bg-orbs" />
      <div className="bg-grid" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[360px]"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <AnimatedLogo size={56} play={false} />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            NutriTracker
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            Connectez-vous à votre espace personnel
          </p>
        </div>

        {/* Card */}
        <div className="glass-strong p-6 space-y-4">

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoad || loading}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl text-[13px] font-medium transition-all"
            style={{
              height: "40px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--text-primary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >
            {googleLoad ? (
              <IconLoader2 size={14} className="animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continuer avec Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>ou</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label-xs block mb-1.5">E-mail</label>
              <div className="relative">
                <IconMail size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9" placeholder="vous@exemple.com"
                  required autoComplete="email" />
              </div>
            </div>

            <div>
              <label className="label-xs block mb-1.5">Mot de passe</label>
              <div className="relative">
                <IconLock size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }} />
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
                  className="input pl-9" placeholder="••••••••"
                  required autoComplete="current-password" />
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-[12px] text-red-400 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                {error}
              </motion.p>
            )}

            <button type="submit" disabled={loading || googleLoad}
              className="btn btn-primary w-full mt-1" style={{ height: "38px" }}>
              {loading
                ? <IconLoader2 size={14} className="animate-spin" />
                : <><span>Connexion</span><IconChevronRight size={13} /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] mt-4" style={{ color: "var(--text-muted)" }}>
          Accès privé · Données stockées dans votre Firestore
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
