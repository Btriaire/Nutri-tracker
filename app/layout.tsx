import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import NavWrapper from "./components/NavWrapper";
import ThemeProvider from "./components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "NutriTracker",
  description: "Suivi nutritionnel personnel connecté à Google Fit & Withings",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={geistSans.variable} suppressHydrationWarning>
      {/* Inline script runs before React hydrates — prevents flash of dark theme */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('theme') === 'light')
              document.documentElement.classList.add('light');
          } catch(e) {}
        ` }} />
      </head>
      <body style={{ background: "var(--bg)", color: "var(--text-primary)", minHeight: "100vh" }}>
        <ThemeProvider>
          <NavWrapper />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
