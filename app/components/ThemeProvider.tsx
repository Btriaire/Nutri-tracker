"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";

export type Theme = "cosmos" | "lumiere";
export type Density = "compact" | "normal" | "large";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "cosmos",
  setTheme: () => {},
  density: "normal",
  setDensity: () => {},
});

export function useTheme() { return useContext(ThemeContext); }

function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.dataset.theme = t;
  // Keep legacy .light class for lumiere (CSS still uses html.light selector)
  html.classList.toggle("light", t === "lumiere");
}

function applyDensity(d: Density) {
  const html = document.documentElement;
  html.dataset.density = d;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("cosmos");
  const [density, setDensityState] = useState<Density>("normal");

  useEffect(() => {
    // Les anciens themes supprimes (mfp = clair, ocean = sombre) migrent vers leur equivalent.
    const raw = localStorage.getItem("nutri-theme");
    const stored = (raw === "mfp" ? "lumiere" : raw === "ocean" ? "cosmos" : raw) as Theme | null;
    // Support legacy "light"/"dark" values from old storage key
    const legacy = localStorage.getItem("theme");
    const validThemes: Theme[] = ["cosmos", "lumiere"];
    const initialTheme: Theme =
      stored && validThemes.includes(stored) ? stored
      : legacy === "light" ? "lumiere"
      : "cosmos";
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    const storedDensity = localStorage.getItem("nutri-density") as Density | null;
    const validDensities: Density[] = ["compact", "normal", "large"];
    const initialDensity: Density =
      storedDensity && validDensities.includes(storedDensity) ? storedDensity : "normal";
    setDensityState(initialDensity);
    applyDensity(initialDensity);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("nutri-theme", t);
    applyTheme(t);
  };

  const setDensity = (d: Density) => {
    setDensityState(d);
    localStorage.setItem("nutri-density", d);
    applyDensity(d);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, density, setDensity }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeContext.Provider>
  );
}
