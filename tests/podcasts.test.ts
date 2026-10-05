import { describe, it, expect } from "vitest";
import { podcastInfo } from "../app/lib/podcasts";

describe("podcastInfo", () => {
  it("lit le type et la date dans le nom du fichier", () => {
    expect(podcastInfo("nutri-semaine-2026-09-26.m4a")).toEqual({ kind: "Semaine", date: "2026-09-26", long: false });
    expect(podcastInfo("nutri-mois-2026-09-26.m4a").kind).toBe("Mois");
    expect(podcastInfo("nutri-long-2026-10-04.m4a")).toEqual({ kind: "Bilan complet", date: "2026-10-04", long: true });
  });

  it("reste lisible pour un nom inconnu", () => {
    expect(podcastInfo("nutri-special-2026-01-02.m4a").kind).toBe("Special");
    expect(podcastInfo("autre.m4a")).toEqual({ kind: "Podcast", date: null, long: false });
    expect(podcastInfo("nutri-2026-08-25.m4a")).toEqual({ kind: "Podcast", date: "2026-08-25", long: false });
  });
});
