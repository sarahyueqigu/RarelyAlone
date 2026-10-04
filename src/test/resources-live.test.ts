import { describe, it, expect } from "vitest";
import { exactMedlineUrl, exactStudyUrl } from "@/lib/resources-live";
describe("live resource URLs", () => {
  it("keeps exact MedlinePlus page URLs", () => {
    expect(exactMedlineUrl("https://medlineplus.gov/genetics/condition/tay-sachs-disease/")).toBe("https://medlineplus.gov/genetics/condition/tay-sachs-disease/");
  });
  it("never uses a MedlinePlus homepage", () => {
    expect(exactMedlineUrl("https://medlineplus.gov/")).toBe("");
    expect(exactMedlineUrl("https://example.com/x")).toBe("");
  });
  it("links studies by NCT ID", () => {
    expect(exactStudyUrl("NCT04221451")).toBe("https://clinicaltrials.gov/study/NCT04221451");
    expect(exactStudyUrl("bad")).toBe("");
  });
});
