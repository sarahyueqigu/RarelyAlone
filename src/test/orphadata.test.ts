import { describe, it, expect } from "vitest";
import { isReliableNameMatch, looksLikeGeneSymbol, normalizeCrossRef, normalizeGenes, normalizePhenotypes, normalizeRareDisease } from "@/lib/orphadata";

describe("orphadata normalization (offline)", () => {
  it("accepts alternate spellings but rejects fuzzy mismatches", () => {
    expect(isReliableNameMatch("Tay Sachs", ["Tay-Sachs disease"])).toBe(true);
    expect(isReliableNameMatch("Niemann-Pick disease type C", ["Niemann-Pick disease type C"])).toBe(true);
    expect(isReliableNameMatch("NPC", ["Niemann-Pick disease type C"])).toBe(false);
  });
  it("detects gene symbols", () => {
    expect(looksLikeGeneSymbol("HEXB")).toBe(true);
    expect(looksLikeGeneSymbol("Gaucher disease")).toBe(false);
  });
  it("handles missing fields safely", () => {
    expect(normalizeCrossRef(undefined)).toEqual([]);
    expect(normalizePhenotypes(null)).toEqual([]);
    expect(normalizeGenes({}, 1)).toEqual([]);
  });
  it("returns null for an unmatched query without calling a fallback", async () => {
    const f = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
    expect(await normalizeRareDisease("zzzz unknown", { fetchImpl: f })).toBeNull();
  });
});

const live = process.env["ORPHADATA_LIVE"] ? describe : describe.skip;
live("orphadata live", () => {
  it("resolves the test queries", async () => {
    expect((await normalizeRareDisease("Tay Sachs"))?.orphaCode).toBe(845);
    expect((await normalizeRareDisease("HEXB"))?.orphaCode).toBe(796);
    expect((await normalizeRareDisease("Niemann-Pick disease type C"))?.orphaCode).toBe(646);
    expect(await normalizeRareDisease("NPC")).toBeNull();
    expect((await normalizeRareDisease("Gaucher disease"))?.orphaCode).toBe(355);
  }, 60000);
});
