// Extracted from food-api.ts so it can be reused server-side (API routes)
// without pulling in food-api.ts's firebase-admin/external-API imports.

export function normalizeFoodName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents: e.g. e-acute -> e
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
