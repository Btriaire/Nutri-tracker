// Signature HMAC du cookie de session — Web Crypto uniquement, pour que le
// MÊME code tourne dans le middleware (runtime Edge, pas de module `crypto`
// Node) et dans les route handlers.
//
// Avant : le cookie était du JSON en base64 SANS signature — n'importe qui
// pouvait fabriquer `session=base64({"userId":"owner",...})` et être
// authentifié sur toutes les routes. Le format signé ci-dessous ("payload.sig")
// est volontairement incompatible avec l'ancien : les anciens cookies échouent
// à la vérification et forcent une reconnexion.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET?.trim();
  // Un secret court ne vaut rien : on préfère refuser (fail closed) plutôt que
  // de signer avec quelque chose de devinable.
  return s && s.length >= 32 ? s : null;
}

export async function signSession(payloadJson: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payloadJson)));
  return `${b64urlFromBytes(enc.encode(payloadJson))}.${b64urlFromBytes(sig)}`;
}

/** Renvoie le JSON du payload si la signature est valide ET non expirée, sinon null. */
export async function verifySession(token: string, secret: string): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null; // ancien format non signé, ou cookie malformé

  try {
    const payloadBytes = bytesFromB64url(token.slice(0, dot));
    const sigBytes     = bytesFromB64url(token.slice(dot + 1));
    const key          = await hmacKey(secret);
    // crypto.subtle.verify compare en temps constant.
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
    if (!ok) return null;

    const json = dec.decode(payloadBytes);
    const exp  = (JSON.parse(json) as { exp?: number }).exp;
    if (typeof exp === "number" && Date.now() > exp) return null;
    return json;
  } catch {
    return null;
  }
}
