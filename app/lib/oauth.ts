import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALG = "aes-256-gcm";

function key() {
  const k = process.env.OAUTH_ENCRYPTION_KEY;
  if (!k) throw new Error("OAUTH_ENCRYPTION_KEY not set");
  return Buffer.from(k, "hex");
}

export function encrypt(text: string): string {
  const iv  = randomBytes(12);
  const c   = createCipheriv(ALG, key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encHex] = data.split(":");
  const d = createDecipheriv(ALG, key(), Buffer.from(ivHex, "hex"));
  d.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([d.update(Buffer.from(encHex, "hex")), d.final()]).toString("utf8");
}
