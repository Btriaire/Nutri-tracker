"use client";

import { usePathname } from "next/navigation";

// Injects the 48px top spacer for the mobile logo bar,
// but NOT on /hub (which uses fixed inset-0 and handles its own spacing).
export default function NavSpacer() {
  const path = usePathname();
  if (path === "/hub" || path === "/" || path === "/login") return null;
  return <div className="md:hidden" style={{ height: "48px" }} />;
}
