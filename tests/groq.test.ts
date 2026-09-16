import { describe, it, expect } from "vitest";
import { describeGroqError, GROQ_VISION_MAX_TOKENS } from "@/app/lib/groq";

// Corps d'erreur RÉELS capturés contre l'API Groq pendant deux pannes :
// le Scan Visage et l'analyse photo de repas sont restés cassés plusieurs
// jours, avec pour seul indice côté client un "Vision API error" opaque.

const OTPM = '{"error":{"message":"Request too large for model `qwen/qwen3.8-27b` in organization `org_x` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Requested 1200. The request\'s expected output tokens exceed the enforced limit; reduce max_tokens.","type":"tokens","code":"rate_limit_exceeded"}}';
const MODELE_DISPARU = '{"error":{"message":"The model `qwen/qwen3.6-27b` does not exist or you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}';
const CLE_INVALIDE = '{"error":{"message":"Invalid API Key","type":"invalid_request_error","code":"invalid_api_key"}}';
const IMAGE_REFUSEE = '{"error":{"message":"Image must have at least 2 pixels in each dimension","type":"invalid_request_error"}}';

describe("describeGroqError", () => {
  it("identifie un modèle renommé/retiré — la panne du Scan Visage", () => {
    const f = describeGroqError(404, MODELE_DISPARU);
    expect(f.code).toBe("model_not_found");
    expect(f.message).toContain("groq.ts"); // dit où corriger
  });

  it("identifie un dépassement du quota OTPM", () => {
    expect(describeGroqError(429, OTPM).code).toBe("rate_limit");
  });

  it("identifie une clé API invalide", () => {
    expect(describeGroqError(401, CLE_INVALIDE).code).toBe("auth");
  });

  it("identifie une requête refusée (image invalide)", () => {
    expect(describeGroqError(400, IMAGE_REFUSEE).code).toBe("bad_request");
  });

  it("retombe sur 'unknown' sans perdre le statut", () => {
    const f = describeGroqError(503, "{}");
    expect(f.code).toBe("unknown");
    expect(f.status).toBe(503);
  });

  it("conserve le corps brut pour les logs mais produit un message en français", () => {
    const f = describeGroqError(404, MODELE_DISPARU);
    expect(f.raw).toBe(MODELE_DISPARU);
    expect(f.message).not.toContain("does not exist"); // pas le message brut anglais
  });
});

describe("GROQ_VISION_MAX_TOKENS", () => {
  it("reste sous le plafond OTPM de 1000 du palier on_demand", () => {
    expect(GROQ_VISION_MAX_TOKENS).toBeLessThan(1000);
  });
});
