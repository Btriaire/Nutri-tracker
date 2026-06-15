"use client";

import { usePathname } from "next/navigation";
import Nav from "./Nav";

// Only show Nav on authenticated app routes (not on /login)
export default function NavWrapper() {
  const path = usePathname();
  if (path === "/login" || path === "/" || path === "/hub") return null;
  return <Nav />;
}
