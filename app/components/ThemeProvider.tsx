"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";

export type Theme = "cosmos" | "lumiere";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "cosmos",
  setTheme: () => {},
});

export function useTheme() { return useContext(ThemeContext); }

function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.dataset.theme = t;
  // Keep legacy .light class for lumiere (CSS still uses html.light selector)
  html.classList.toggle("light", t === "lumiere");
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("cosmos");

  useEffect(() => {
    // Les anciens themes supprimes (mfp = clair, ocean = sombre) migrent vers leur equivalent.
    const raw = localStorage.getItem("nutri-theme");
    const stored = (raw === "mfp" ? "lumiere" : raw === "ocean" ? "cosmos" : raw) as Theme | null;
    // Support legacy "light"/"dark" values from old storage key
    const legacy = localStorage.getItem("theme");
    const validThemes: Theme[] = ["cosmos", "lumiere"];
    const initial: Theme =
      stored && validThemes.includes(stored) ? stored
      : legacy === "light" ? "lumiere"
      : "cosmos";
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("nutri-theme", t);
    applyTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeContext.Provider>
  );
}
