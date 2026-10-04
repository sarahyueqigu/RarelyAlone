import { describe, it, expect } from "vitest";
import { rankEducation, rankTrials, isStrongTrial } from "@/lib/resources-relevance";
import { contextToReuse, retrieveEvidence } from "@/lib/ask-evidence";
import type { OrphaDisease } from "@/lib/orphadata";
import type { ClinicalTrialStudy } from "@/lib/clinical-trials";
import type { ResourcesSearchResult } from "@/lib/resources-search";

const tay = { orphaCode: 845, preferredName: "Tay-Sachs disease", synonyms: ["GM2 gangliosidosis, variant B"], genes: [{ symbol: "HEXA" }] } as unknown as OrphaDisease;
const edu = (title: string, summary = "") => ({ title, summary, url: `https://medlineplus.gov/${title}`, subject: null, sourceName: "MedlinePlus", resourceType: "condition" as const, lastUpdated: null });
const trial = (officialTitle: string, conditions: string[]) => ({ officialTitle, conditions, interventions: [], url: `https://clinicaltrials.gov/study/${officialTitle}` }) as unknown as ClinicalTrialStudy;

describe("resources relevance", () => {
  it("drops symptom pages that don't mention the disease and ranks disease > gene", () => {
    const r = rankEducation([edu("Seizures"), edu("High Blood Pressure in Pregnancy", "can cause seizures"), edu("HEXA gene"), edu("Tay-Sachs disease")], tay);
    expect(r.map((e) => e.title)).toEqual(["Tay-Sachs disease", "HEXA gene"]);
  });
  it("ranks disease-directed studies above broad multi-condition ones", () => {
    const broad = trial("Newborn screening study", ["Tay-Sachs Disease", "Cystic Fibrosis", "PKU", "Sickle Cell", "Hearing loss"]);
    const direct = trial("Gene therapy for Tay-Sachs disease", ["Tay-Sachs Disease"]);
    expect(rankTrials([broad, direct], tay).map((t) => t.officialTitle)).toEqual(["Gene therapy for Tay-Sachs disease", "Newborn screening study"]);
    expect(isStrongTrial(broad, tay)).toBe(false);
    expect(rankTrials([trial("Unrelated", ["Asthma"])], tay)).toEqual([]);
  });
});

describe("Ask follow-up context", () => {
  const ctx = ["Tay-Sachs disease", "Sandhoff disease"];
  it("reuses a context disease the question mentions", () => {
    expect(contextToReuse("What do these sources say about how Tay-Sachs affects the brain?", ctx, [])).toEqual(["Tay-Sachs disease"]);
  });
  it("reuses all context for a referential follow-up", () => {
    expect(contextToReuse("What causes it?", ctx, [])).toEqual(ctx);
  });
  it("prefers a new explicit entity and ignores unrelated questions", () => {
    expect(contextToReuse("What does GBA1 do?", ctx, ["Gaucher disease"])).toEqual([]);
    expect(contextToReuse("Is purple a good color?", ctx, [])).toEqual([]);
  });
  it("retrieves evidence through the reused context", async () => {
    const search = async (q: string): Promise<ResourcesSearchResult> => ({
      originalQuery: q, normalizedDisease: q === "Tay-Sachs disease" ? tay : null,
      searchTerms: { diseaseTerm: null, extraTerms: [], medlinePlusQueries: [], clinicalTrialsQuery: null },
      patientEducation: [edu("Tay-Sachs disease")], clinicalTrials: [], duplicatesRemoved: 0, errors: [],
    });
    const ev = await retrieveEvidence("What do these sources say about how Tay-Sachs affects the brain?", search, ["Tay-Sachs disease"]);
    expect(ev.diseases.map((d) => d.name)).toEqual(["Tay-Sachs disease"]);
    expect(ev.sources).toHaveLength(1);
  });
});
