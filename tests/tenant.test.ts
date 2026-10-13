import { describe, it, expect } from "vitest";
import { resolveUserId } from "../app/lib/tenant";

describe("resolveUserId", () => {
  const env = { adminEmail: "bruno@example.com", allowedEmails: "amie@example.com, Autre@Example.com" };
  it("le proprietaire garde l'espace owner", () => {
    expect(resolveUserId("Bruno@example.com", "uid-b", env)).toBe("owner");
  });
  it("un compte autorise a son propre espace (uid)", () => {
    expect(resolveUserId("amie@example.com", "uid-amie", env)).toBe("uid-amie");
    expect(resolveUserId("autre@example.com", "uid-x", env)).toBe("uid-x");
  });
  it("un email non autorise est refuse", () => {
    expect(resolveUserId("intrus@example.com", "uid-i", env)).toBeNull();
    expect(resolveUserId("amie@example.com", "uid-amie", { adminEmail: "bruno@example.com" })).toBeNull();
  });
});
