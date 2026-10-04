import { describe, it, expect } from "vitest";
import { biologyConnections, organizationsFor, researchActionFor, ALL_DISEASE_IDS } from "@/data/circle-connections";
import { organizations } from "@/data/community";

describe("Find My Circle connections", () => {
  it("lists each organization once even when it supports several diseases", () => {
    const names = organizations.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
    const ntsad = organizations.find((o) => o.name.includes("NTSAD"))!;
    expect(ntsad.diseases).toEqual(expect.arrayContaining(["tay-sachs", "sandhoff"]));
  });
  it("shows a documented Sandhoff connection from Tay-Sachs, linked to the Atlas", () => {
    const c = biologyConnections("tay-sachs").find((x) => x.other === "sandhoff")!;
    expect(c.status).toBe("Documented");
    expect(c.atlasPairId).toBe("gm2");
    expect(c.sources.length).toBeGreaterThan(0);
    expect(c.orgs.some((o) => o.alsoSupportsSelected)).toBe(true);
  });
  it("never labels broad category overlap as a specific mechanism", () => {
    for (const d of ALL_DISEASE_IDS)
      for (const c of biologyConnections(d)) if (c.kind === "category") expect(c.mechanism).toBeNull();
  });
  it("marks the SPG11 organization as broader support", () => {
    expect(organizationsFor("spg11").some((o) => o.relation === "broader_support")).toBe(true);
  });
  it("finds a sourced research action for each disease", () => {
    for (const d of ALL_DISEASE_IDS) {
      const a = researchActionFor(d);
      console.log(d, a?.pairId, a?.asset, a?.collaborator?.name, a?.sources.length);
      if (a) expect(a.sources.length).toBeGreaterThan(0);
    }
  });
});
