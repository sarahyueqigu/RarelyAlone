import { describe, it, expect } from "vitest";
import { lookupPatientEducation, normalizeGenetics, parseHealthTopicsXml } from "@/lib/medlineplus";

const notFound = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;

describe("MedlinePlus education service", () => {
  it("returns an empty list when no official result exists", async () => {
    expect(await lookupPatientEducation("Tay-Sachs", { fetchImpl: notFound })).toEqual([]);
  });
  it("returns nothing for an empty query", async () => {
    expect(await lookupPatientEducation("  ")).toEqual([]);
  });
  it("rejects records without an official URL", () => {
    expect(normalizeGenetics({ name: "X", "ghr-page": "https://example.com/x" }, "gene")).toBeNull();
  });
  it("keeps missing summaries and dates as null", () => {
    const r = normalizeGenetics({ name: "Gaucher disease", ghr_page: "https://medlineplus.gov/genetics/condition/gaucher-disease" }, "condition")!;
    expect(r.summary).toBeNull();
    expect(r.lastUpdated).toBeNull();
  });
  it("parses health topic search results", () => {
    const xml = `<list><document rank="0" url="https://medlineplus.gov/taysachsdisease.html"><content name="title">&lt;span&gt;Tay-Sachs&lt;/span&gt; Disease</content><content name="FullSummary">&lt;p&gt;First.&lt;/p&gt;&lt;p&gt;Second.&lt;/p&gt;</content></document></list>`;
    const [r] = parseHealthTopicsXml(xml, 5);
    expect(r?.title).toBe("Tay-Sachs Disease");
    expect(r?.summary).toBe("First.");
  });
});
