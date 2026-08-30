import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Deuxieme app Firebase Admin, distincte de celle de nutri-tracker
// (lib/firebase-admin.ts) — pointe vers le projet Firebase de blood-doctor,
// une autre app personnelle du meme utilisateur, en LECTURE SEULE (voir
// blood-doctor-source.ts). Nommee explicitement pour ne pas entrer en
// collision avec l'app par defaut au sein du meme runtime.
const APP_NAME = "blood-doctor";

function getBloodDoctorApp() {
  const projectId = process.env.BLOOD_DOCTOR_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.BLOOD_DOCTOR_FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.BLOOD_DOCTOR_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) return null;

  const existing = getApps().find((a) => a.name === APP_NAME);
  return existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, APP_NAME);
}

/** null si les identifiants ne sont pas configures — l'appelant traite ceci comme "donnees blood-doctor indisponibles", jamais une erreur bloquante. */
export function getBloodDoctorFirestore() {
  const app = getBloodDoctorApp();
  return app ? getFirestore(app) : null;
}
