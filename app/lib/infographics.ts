export const INFOGRAPHICS = "users/owner/infographics";
export const MAX_IMAGE_BYTES = 700_000; // base64 (+33 %) doit tenir sous la limite de 1 Mio d un document Firestore

export type InfographicPeriod = "semaine" | "mois";

export interface InfographicMeta {
  id: string;
  period: InfographicPeriod;
  from: string;
  to: string;
  createdAt: string;
  bytes: number;
  title?: string;
}
