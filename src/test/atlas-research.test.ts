import { describe, it, expect } from "vitest";
import { atlasResearchFor } from "@/lib/atlas-research";

const ids = (q: string) => atlasResearchFor(q)?.records.map((r) => r.id) ?? [];

describe("Research fallback reads Atlas citations", () => {
  it("SPG11 aliases include Atlas-cited SPG11 papers", () => {
    for (const q of ["SPG11", "SPG 11", "SPG-11", "Autosomal recessive spastic paraplegia type 11"]) {
      const r = ids(q);
      for (const s of ["S05", "S06", "S07", "S08", "S09", "S10"]) expect(r, q).toContain(s);
    }
  });
  it("registry, regulatory and patient-organisation sources stay out", () => {
    for (const q of ["SPG11", "Tay-Sachs", "Sandhoff", "NPC", "Gaucher"]) {
      const recs = atlasResearchFor(q)!.records;
      expect(recs.length, q).toBeGreaterThan(0);
      for (const r of recs) expect(r.type).not.toMatch(/registry|regulatory|patient organi/i);
    }
    expect(ids("SPG11")).not.toContain("S15");
  });
  it("records are unique by identifier", () => {
    const recs = atlasResearchFor("NPC Gaucher")!.records;
    expect(new Set(recs.map((r) => r.pmid ?? r.doi ?? r.url)).size).toBe(recs.length);
  });
  it("non-curated query returns nothing", () => expect(atlasResearchFor("Noonan syndrome")).toBeNull());
});
