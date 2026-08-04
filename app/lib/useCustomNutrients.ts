"use client";

import { useEffect } from "react";
import { mergeCustomNutrients } from "./micronutrients";
import type { MicronutrientInfo } from "./types";

// Module-level guard — avoids re-fetching from every component instance that
// mounts during the same page session (MICRONUTRIENT_DB is a shared module
// singleton, so merging once is enough for the whole page).
let loaded = false;

/** Fetches the user's custom nutrients once and merges them into MICRONUTRIENT_DB. */
export function useCustomNutrients() {
  useEffect(() => {
    if (loaded) return;
    loaded = true;
    fetch("/api/custom-nutrients")
      .then(r => r.ok ? r.json() : null)
      .then((d: { nutrients?: MicronutrientInfo[] } | null) => {
        if (d?.nutrients?.length) mergeCustomNutrients(d.nutrients);
      })
      .catch(() => { loaded = false; }); // allow a retry on next mount if the fetch failed
  }, []);
}
