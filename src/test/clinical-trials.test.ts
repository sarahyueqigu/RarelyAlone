import { describe, it, expect } from "vitest";
import { normalizeStudy, searchClinicalTrials } from "@/lib/clinical-trials";

describe("clinical trials service", () => {
  it("handles missing fields without inventing data", () => {
    const s = normalizeStudy({ protocolSection: { identificationModule: { nctId: "NCT0" } } })!;
    expect(s.briefSummary).toBeNull();
    expect(s.conditions).toEqual([]);
    expect(s.url).toBe("https://clinicaltrials.gov/study/NCT0");
  });
  it("drops records without an NCT ID", () => {
    expect(normalizeStudy({})).toBeNull();
  });
  it("returns no studies for an empty query", async () => {
    expect(await searchClinicalTrials("  ")).toEqual([]);
  });
  it("defaults to 5 results", async () => {
    let url = "";
    const fake = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ studies: [] }));
    }) as unknown as typeof fetch;
    await searchClinicalTrials("GM2", { fetchImpl: fake });
    expect(url).toContain("pageSize=5");
  });
});
