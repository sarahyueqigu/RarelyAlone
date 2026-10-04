import { describe, expect, it } from "vitest";
import { expandAliases } from "@/lib/resources-search";
import { detectAtlasDiseases, atlasEvidence } from "@/lib/ask-atlas";

describe("SPG11 normalization", () => {
  for (const v of ["SPG11", "SPG 11", "SPG-11", "autosomal recessive spastic paraplegia type 11", "spastic paraplegia type 11"]) {
    it(`"${v}" resolves to SPG11`, () => {
      expect(expandAliases(v)).toBe("Spastic paraplegia type 11");
      expect(detectAtlasDiseases(`What is ${v}?`)).toEqual(["spg"]);
    });
  }
});

describe("Atlas evidence for Ask", () => {
  it("detects SPG11, Tay-Sachs and Sandhoff in the demo question", () => {
    expect(detectAtlasDiseases("How is SPG11 connected to Tay-Sachs and Sandhoff?")).toEqual(["spg", "tay", "sand"]);
  });
  it("GM2 diseases means Tay-Sachs and Sandhoff", () => {
    expect(detectAtlasDiseases("SPG11 and GM2 diseases")).toEqual(["spg", "tay", "sand"]);
  });
  it("cites only curated references with real URLs, numbered from S1", () => {
    const ev = atlasEvidence(["spg", "tay", "sand"]);
    expect(ev.sources.length).toBeGreaterThan(0);
    ev.sources.forEach((s, i) => { expect(s.id).toBe(`S${i + 1}`); expect(s.url).toMatch(/^https:\/\//); });
    expect(ev.notes).toContain("SPG11 ↔");
  });
});
