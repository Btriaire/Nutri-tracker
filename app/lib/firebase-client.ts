"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// trim() : des variables Vercel saisies avec un retour a la ligne cassaient l'authDomain (popup Google en echec)
const firebaseConfig = {
  apiKey:     process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
};

export function getClientAuth() {
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    throw new Error("Missing Firebase client environment variables");
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getAuth(app);
}
