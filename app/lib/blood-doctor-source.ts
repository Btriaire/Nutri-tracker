// Lecture SEULE des analyses de sang confirmees dans blood-doctor (autre app
// perso du meme utilisateur) — but : recuperer TG/HDL reels pour affiner le
// calcul du VAI (voir BodyCompChart.tsx), a la place d'une estimation a
// partir du % de graisse seul quand une vraie analyse existe. Jamais ecrit,
// jamais un echec bloquant pour nutri-tracker : toute erreur ou absence de
// configuration renvoie simplement un historique vide.

import { getBloodDoctorFirestore } from "./blood-doctor-admin";

interface BloodTestResult {
  key:   string;
  value: number;
  unit:  string;
}

interface BloodTestDoc {
  status:     string;
  sampleDate?: string;
  results:    BloodTestResult[];
}

export interface LipidReading {
  date:    string; // sampleDate "YYYY-MM-DD"
  tgMgDl:  number | null;
  hdlMgDl: number | null;
}

// blood-doctor stocke TG/HDL en g/L (unite canonique francaise) — 1 g/L = 100 mg/dL.
function toMgDl(value: number, unit: string): number {
  if (unit === "g/L") return Math.round(value * 100);
  if (unit === "mg/dL") return Math.round(value);
  return Math.round(value * 100); // fallback : suppose g/L, l'unite canonique observee pour ces marqueurs
}

/** Historique des lipides (TG/HDL) confirmes dans blood-doctor, en mg/dL, tries par date croissante.
 *  [] si blood-doctor n'est pas configure/joignable. */
export async function getBloodDoctorLipidHistory(): Promise<LipidReading[]> {
  const db = getBloodDoctorFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection("tests").where("status", "==", "confirmed").get();
    const readings: LipidReading[] = [];

    snap.docs.forEach((doc) => {
      const t = doc.data() as BloodTestDoc;
      if (!t.sampleDate || !Array.isArray(t.results)) return;
      const tg  = t.results.find((r) => r.key === "triglycerides");
      const hdl = t.results.find((r) => r.key === "hdl");
      if (!tg && !hdl) return;
      readings.push({
        date:    t.sampleDate,
        tgMgDl:  tg  ? toMgDl(tg.value, tg.unit)   : null,
        hdlMgDl: hdl ? toMgDl(hdl.value, hdl.unit) : null,
      });
    });

    return readings.sort((a, b) => (a.date < b.date ? -1 : 1));
  } catch (err) {
    console.error("blood-doctor lipid history fetch failed", err);
    return [];
  }
}
