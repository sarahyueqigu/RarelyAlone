import { describe, expect, it } from "vitest";
import { searchResourcesAggregate } from "@/lib/resources-search";
import { curatedTrialIds } from "@/lib/ask-atlas";
import { trialToResource } from "@/lib/resources-live";
import type { ClinicalTrialStudy } from "@/lib/clinical-trials";

const study = { nctId: "NCT04768166", officialTitle: "TreatSPG11", briefSummary: null, conditions: ["Spastic Paraplegia 11"], interventions: [], overallStatus: "COMPLETED", studyType: null, phases: [], minimumAge: null, maximumAge: null, sex: null, locations: [], leadSponsor: null, startDate: null, completionDate: null, lastUpdateDate: null, url: "https://clinicaltrials.gov/study/NCT04768166" } as ClinicalTrialStudy;
const normalize = async () => ({ orphaCode: "1", preferredName: "Autosomal recessive spastic paraplegia type 11", synonyms: ["SPG11"], genes: [{ symbol: "SPG11" }] }) as never;

describe("SPG11 clinical studies", () => {
  it("curated Atlas cites only the registry record NCT04768166 for SPG11", () => {
    expect(curatedTrialIds(["spg"])).toEqual(["NCT04768166"]);
  });
  for (const q of ["SPG11", "SPG 11", "SPG-11", "Autosomal recessive spastic paraplegia type 11"]) {
    it(`"${q}" adds the curated study by exact NCT lookup`, async () => {
      const r = await searchResourcesAggregate(q, { normalize, education: async () => [], trials: async () => [], trialById: async () => study });
      expect(r.clinicalTrials.map((s) => s.nctId)).toEqual(["NCT04768166"]);
    });
  }
  it("completed studies are marked non-recruiting", () => {
    expect(trialToResource(study, true).active).toBe(false);
  });
});
