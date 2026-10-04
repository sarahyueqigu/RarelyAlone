import { describe, expect, it } from "vitest";
import { compare, diseases, nodeMap, pairs, sourceMap } from "@/lib/atlas/graph";
import { caveats, hypotheses, patientExplanation } from "@/lib/atlas/hypotheses";

describe("atlas scientific data", () => {
  it("loads diseases, maps, hypotheses and caveats", () => {
    expect(diseases.map((d) => d.id)).toEqual(["tay", "sand", "npc", "gaucher", "spg"]);
    expect(Object.keys(nodeMap).length).toBeGreaterThan(0);
    expect(Object.keys(sourceMap).length).toBeGreaterThan(0);
    expect(hypotheses().length).toBeGreaterThan(0);
    expect(caveats).toBeTruthy();
    for (const d of diseases) for (const e of d.edges) {
      expect(nodeMap[e.source], `${e.id} source`).toBeTruthy();
      expect(nodeMap[e.target], `${e.id} target`).toBeTruthy();
      for (const s of e.sourceIds) expect(sourceMap[s], `${e.id} ref ${s}`).toBeTruthy();
    }
  });

  it.each(pairs)("compares $label", (p) => {
    const c = compare(p.a, p.b);
    expect(Number.isFinite(c.overall)).toBe(true);
    expect(patientExplanation(p.id).known).toBeTruthy();
    console.log(p.label, "overall", c.overall.toFixed(1), "confidence", c.confidence.toFixed(1), "shared", c.shared.length,
      c.metrics.map((m) => `${m.id}:${m.score === null ? "n/a" : m.score.toFixed(1)}`).join(" "));
  });
});
