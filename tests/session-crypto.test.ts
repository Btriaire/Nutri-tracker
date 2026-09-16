import { describe, it, expect } from "vitest";
import { signSession, verifySession, sessionSecret } from "@/app/lib/session-crypto";

// Correctif de sécurité : le cookie de session était du JSON en base64 SANS
// signature, et le middleware ne testait que sa présence — fabriquer
// base64('{"userId":"owner"}') suffisait pour être authentifié partout.
// Ces tests empêchent une régression silencieuse de ce garde-fou.

const SECRET = "a".repeat(64);
const AUTRE  = "b".repeat(64);
const payload = () => JSON.stringify({ userId: "owner", email: "x@y.z", name: "Bruno", exp: Date.now() + 60_000 });

describe("signSession / verifySession", () => {
  it("accepte un token qu'il vient de signer", async () => {
    const p = payload();
    expect(await verifySession(await signSession(p, SECRET), SECRET)).toBe(p);
  });

  it("REJETTE l'ancien format non signé (JSON en base64)", async () => {
    const ancien = Buffer.from('{"userId":"owner","email":"x","name":"y"}').toString("base64");
    expect(await verifySession(ancien, SECRET)).toBeNull();
  });

  it("rejette un payload altéré qui réutilise une signature valide", async () => {
    const token = await signSession(payload(), SECRET);
    const sig = token.slice(token.indexOf(".") + 1);
    const forge = Buffer.from(JSON.stringify({ userId: "attaquant", exp: Date.now() + 60_000 })).toString("base64url");
    expect(await verifySession(`${forge}.${sig}`, SECRET)).toBeNull();
  });

  it("rejette un token signé avec un autre secret", async () => {
    expect(await verifySession(await signSession(payload(), AUTRE), SECRET)).toBeNull();
  });

  it("rejette un token expiré même si la signature est bonne", async () => {
    const expire = await signSession(JSON.stringify({ userId: "owner", exp: Date.now() - 1000 }), SECRET);
    expect(await verifySession(expire, SECRET)).toBeNull();
  });

  it("rejette les cookies malformés sans lever d'exception", async () => {
    for (const mauvais of ["", ".", "abc", "abc.", ".abc", "pas-de-point", "a.b.c"]) {
      expect(await verifySession(mauvais, SECRET)).toBeNull();
    }
  });
});

describe("sessionSecret — fail closed", () => {
  it("refuse un secret absent ou trop court (< 32 caractères)", () => {
    const sauvegarde = process.env.SESSION_SECRET;
    try {
      delete process.env.SESSION_SECRET;
      expect(sessionSecret()).toBeNull();
      process.env.SESSION_SECRET = "trop-court";
      expect(sessionSecret()).toBeNull();
      process.env.SESSION_SECRET = SECRET;
      expect(sessionSecret()).toBe(SECRET);
    } finally {
      if (sauvegarde === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = sauvegarde;
    }
  });
});
