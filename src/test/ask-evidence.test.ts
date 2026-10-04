import { describe, it, expect } from "vitest";
import { filterRelevant, questionToQueries, retrieveEvidence, validSourceIds } from "@/lib/ask-evidence";
import type { ResourcesSearchResult } from "@/lib/resources-search";
import type { OrphaDisease } from "@/lib/orphadata";

const sandhoff = { orphaCode: 796, preferredName: "Sandhoff disease", synonyms: [], genes: [{ symbol: "HEXB" }] } as unknown as OrphaDisease;
const edu = (title: string, url: string, summary = "") => ({ title, url, summary, subject: null, sourceName: "MedlinePlus", resourceType: "condition" as const, lastUpdated: null });
const base = (over: Partial<ResourcesSearchResult>): ResourcesSearchResult => ({
  originalQuery: "", normalizedDisease: sandhoff, searchTerms: { diseaseTerm: "Sandhoff", extraTerms: [], medlinePlusQueries: [], clinicalTrialsQuery: null },
  patientEducation: [], clinicalTrials: [], duplicatesRemoved: 0, errors: [], ...over,
});

describe("Ask Rarely Alone evidence", () => {
  it("turns questions into disease search phrases", () => {
    expect(questionToQueries("What does HEXB do?")).toEqual(["HEXB"]);
    expect(questionToQueries("Why are Tay-Sachs and Sandhoff related?")).toEqual(["Tay-Sachs", "Sandhoff"]);
    expect(questionToQueries("Are there studies involving Sandhoff disease?")).toEqual(["Sandhoff disease"]);
  });
  it("drops results that don't mention the recognized disease", () => {
    const r = filterRelevant(base({ patientEducation: [edu("Sandhoff disease", "https://medlineplus.gov/a"), edu("Pulmonary Hypertension", "https://medlineplus.gov/b")] }));
    expect(r.education.map((e) => e.title)).toEqual(["Sandhoff disease"]);
  });
  it("returns no sources when no disease is recognized", async () => {
    const ev = await retrieveEvidence("Is purple a good color?", async () => base({ normalizedDisease: null, patientEducation: [edu("Purple", "https://medlineplus.gov/p")] }));
    expect(ev.sources).toEqual([]);
  });
  it("only keeps source IDs that were supplied", () => {
    expect(validSourceIds(["S1", "S9", "S1"], [{ id: "S1" } as never])).toEqual(["S1"]);
  });
});
