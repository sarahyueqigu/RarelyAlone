// Curated Atlas evidence for Ask Rarely Alone. Reads the verbatim Atlas files; never alters scores or edges.
import { compare, diseaseMap, nodeMap, sourceMap, type Edge } from "./atlas/graph";
import type { EvidenceSource } from "./ask-evidence";

/** Explicit, case-insensitive phrases for the five curated diseases. "GM2 diseases" means Tay–Sachs + Sandhoff. */
const PHRASES: [RegExp, string[]][] = [
  [/\bspg[\s-]?11\b|\bspastic paraplegia (?:type )?11\b|\bspatacsin\b/i, ["spg"]],
  [/\btay[\s–-]?sachs\b|\bhexa\b/i, ["tay"]],
  [/\bsandhoff\b|\bhexb\b/i, ["sand"]],
  [/\bgm2\b/i, ["tay", "sand"]],
  [/\bniemann[\s–-]?pick\b|\bnpc[12]?\b/i, ["npc"]],
  [/\bgaucher\b|\bgba1?\b/i, ["gaucher"]],
];

export function detectAtlasDiseases(text: string): string[] {
  const out: string[] = [];
  for (const [re, ids] of PHRASES) if (re.test(text)) ids.forEach((id) => !out.includes(id) && out.push(id));
  return out;
}

export const atlasDiseaseName = (id: string) => diseaseMap[id]?.name ?? id;

const label = (id: string) => nodeMap[id]?.label ?? diseaseMap[id]?.short ?? id;
const describeEdge = (e: Edge) =>
  `[${diseaseMap[e.disease]?.short ?? e.disease}] ${label(e.source)} —${e.relationship}→ ${label(e.target)}: ${e.summary} ` +
  `(evidence type: ${e.evidenceType}; ${e.direct ? "documented/direct" : "inferred/candidate"}; confidence ${e.confidence}; context: ${e.context}` +
  `${e.polarity !== "support" ? `; polarity: ${e.polarity}` : ""}${e.contradictions.length ? `; ${e.contradictions.length} contradicting finding(s) recorded` : ""})`;

export interface AtlasEvidence { sources: EvidenceSource[]; notes: string; names: string[] }

/**
 * One source per curated reference cited by the detected diseases' edges, then a comparison note that
 * refers to those sources by their final IDs. `startIndex` is the S-number the first source will get.
 */
export function atlasEvidence(ids: string[], startIndex = 1, maxSources = 10): AtlasEvidence {
  if (!ids.length) return { sources: [], notes: "", names: [] };
  const edges = ids.flatMap((id) => diseaseMap[id]?.edges ?? []);
  const byRef = new Map<string, Edge[]>();
  for (const e of edges) for (const r of e.sourceIds) byRef.set(r, [...(byRef.get(r) ?? []), e]);
  // Pairs to compare: every detected pair; a lone SPG11 is compared with each curated disease that shares cited evidence.
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i]!, ids[j]!]);
  if (ids.length === 1 && ids[0] === "spg") (["tay", "sand", "npc", "gaucher"]).forEach((o) => pairs.push(["spg", o]));
  const comps = pairs.map(([a, b]) => compare(a, b)).filter((c) => c.shared.length);
  const pathEdgeIds = new Set(comps.flatMap((c) => c.shared.flatMap((f) => [...f.pathA, ...f.pathB])));
  // References supporting comparison paths first, then those citing the most edges.
  const refs = [...byRef.entries()].sort((x, y) =>
    Number(y[1].some((e) => pathEdgeIds.has(e.id))) - Number(x[1].some((e) => pathEdgeIds.has(e.id))) || y[1].length - x[1].length,
  ).slice(0, maxSources);
  const idFor = new Map<string, string>();
  let n = startIndex;
  const sources: EvidenceSource[] = refs.flatMap(([ref, es]) => {
    const s = sourceMap[ref];
    if (!s?.url) return [];
    const sid = `S${n++}`;
    idFor.set(ref, sid);
    return [{ id: sid, kind: "atlas" as const, title: s.title, sourceName: `Atlas curated reference · ${s.type}`, url: s.url,
      text: `Curated Atlas reference (${s.type}, ${s.year}). Edges citing it:\n${es.slice(0, 8).map(describeEdge).join("\n")}` }];
  });
  const cite = (edgeIds: string[]) => [...new Set(edgeIds.flatMap((id) => edges.find((e) => e.id === id)?.sourceIds ?? []).map((r) => idFor.get(r)).filter(Boolean))].join(", ") || "no supplied source";
  const intro = ids.map((id) => `${diseaseMap[id]!.name} (${diseaseMap[id]!.short}): ${diseaseMap[id]!.plain} Scope: ${diseaseMap[id]!.scope}`).join("\n");
  const compText = comps.map((c) => {
    const feats = c.shared.slice(0, 8).map((f) => `- ${label(f.id)} (${nodeMap[f.id]?.dimension}); supported by ${cite([...f.pathA, ...f.pathB])}`).join("\n");
    const dims = c.metrics.map((m) => `${m.id} ${m.score === null ? "no data" : m.score.toFixed(0)}`).join(", ");
    return `${diseaseMap[c.a]!.short} ↔ ${diseaseMap[c.b]!.short}: Atlas overall similarity ${c.overall.toFixed(1)}/100 (dimensions: ${dims}). Shared features:\n${feats}`;
  }).join("\n\n");
  const notes = `Curated Atlas disease summaries:\n${intro}${compText ? `\n\nAtlas comparisons (computed only from the curated edges; a shared feature is biology, not a shared treatment):\n${compText}` : ""}`;
  return { sources, notes, names: ids.map(atlasDiseaseName) };
}

/** NCT IDs of ClinicalTrials.gov registry sources the curated Atlas links to these diseases (no preclinical sources). */
export function curatedTrialIds(diseaseIds: string[]): string[] {
  const ids = new Set<string>();
  for (const d of diseaseIds) for (const n of diseaseMap[d]?.nodeIds ?? []) {
    const m = /clinicaltrials\.gov\/study\/(NCT\d{8})$/.exec(sourceMap[n]?.url ?? "");
    if (m?.[1]) ids.add(m[1]);
  }
  return [...ids];
}
