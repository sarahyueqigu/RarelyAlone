import { describe, it, expect } from "vitest";
import { dedupeByUrl, expandAliases, searchResourcesAggregate } from "@/lib/resources-search";
import type { OrphaDisease } from "@/lib/orphadata";

const npc = { orphaCode: 646, preferredName: "Niemann-Pick disease type C" } as OrphaDisease;

describe("resources search aggregator", () => {
  it("expands the explicit NPC alias case-insensitively", () => {
    expect(expandAliases("NPC swallowing")).toBe("Niemann-Pick disease type C swallowing");
    expect(expandAliases("npc swallowing")).toBe("Niemann-Pick disease type C swallowing");
  });
  it("removes duplicate URLs", () => {
    const r = dedupeByUrl([{ url: "https://a.gov/x" }, { url: "https://a.gov/x/" }, { url: "https://a.gov/y" }]);
    expect(r.items).toHaveLength(2);
    expect(r.removed).toBe(1);
  });
  it("keeps MedlinePlus results when ClinicalTrials.gov fails", async () => {
    const r = await searchResourcesAggregate("NPC swallowing", {
      normalize: async (q) => (q === "Niemann-Pick disease type C" ? npc : null),
      education: async (q) => [{ title: q, sourceName: "MedlinePlus", resourceType: "condition", subject: null, summary: null, url: `https://medlineplus.gov/${q.length}`, lastUpdated: null }],
      trials: async () => { throw new Error("down"); },
    });
    expect(r.normalizedDisease?.orphaCode).toBe(646);
    expect(r.searchTerms.extraTerms).toEqual(["swallowing"]);
    expect(r.patientEducation.map((e) => e.title)).toEqual(["Niemann-Pick disease type C"]); // "swallowing" page lacks the disease
    expect(r.clinicalTrials).toEqual([]);
    expect(r.errors.map((e) => e.source)).toEqual(["ClinicalTrials.gov"]);
  });
});
