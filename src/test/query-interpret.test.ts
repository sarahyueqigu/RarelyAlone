import { describe, it, expect } from "vitest";
import { extractQuery } from "@/lib/query-interpret";
import { expandAliases, searchResourcesAggregate } from "@/lib/resources-search";
import { questionToQueries } from "@/lib/ask-evidence";
import type { OrphaDisease } from "@/lib/orphadata";

describe("query interpretation", () => {
  it.each([
    ["What does HEXB do?", "HEXB"], ["what does hexb do?", "hexb"], ["WHAT DOES HEXB DO?", "HEXB"],
    ["tell me about Gaucher disease", "Gaucher disease"], ["are there studies for sandhoff disease?", "sandhoff disease"],
    ["What is AIP?", "AIP"], ["npc swallowing", "npc swallowing"], ["information about Tay-Sachs", "Tay-Sachs"],
  ])("%s -> %s", (q, out) => expect(extractQuery(q)).toBe(out));

  it("expands explicit aliases case-insensitively", () => {
    for (const v of ["NPC", "npc", "Npc"]) expect(expandAliases(`${v} swallowing`)).toBe("Niemann-Pick disease type C swallowing");
    for (const v of ["AIP", "aip"]) expect(expandAliases(v)).toBe("Acute intermittent porphyria");
    expect(expandAliases("XYZ")).toBe("XYZ");
  });

  it("chat queries reduce to the entity", () => {
    expect(questionToQueries("what does hexb do?")).toEqual(["hexb"]);
    expect(questionToQueries("What is AIP?")).toEqual(["AIP"]);
  });

  it("hexb, Hexb and HEXB resolve to the same canonical gene query", async () => {
    const sandhoff = { orphaCode: 796, preferredName: "Sandhoff disease" } as OrphaDisease;
    const seen: string[] = [];
    for (const v of ["what does hexb do?", "Hexb", "HEXB"]) {
      const r = await searchResourcesAggregate(v, {
        normalize: async (q) => { seen.push(q); return q === "HEXB" ? sandhoff : null; },
        education: async () => [], trials: async () => [],
      });
      expect(r.normalizedDisease?.orphaCode).toBe(796);
      expect(r.searchTerms.diseaseTerm).toBe("HEXB");
    }
  });
});
