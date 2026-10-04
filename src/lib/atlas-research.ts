// Research-section fallback: reuses the exact Atlas citation stores the Atlas UI renders
// (disease edges + contradictions, pair-page ledger/qualifying edges, patient explanations, caveats, hypotheses).
// Read-only: never alters Atlas data or scoring.
import { compare, diseaseMap, edgeMap, evidenceSources, pairs, sourceMap, strongestPaths, type Edge, type Source } from "./atlas/graph";
import { caveats, hypotheses, patientExplanation } from "./atlas/hypotheses";
import { detectAtlasDiseases } from "./ask-atlas";

/** Metadata exactly as stored in sources.json; identifiers are read from the stored URL only. */
export interface AtlasResearchRecord {
  id: string; title: string; type: string; year: string | number | null; url: string;
  pmid: string | null; doi: string | null; nct: string | null; diseases: string[];
}
export interface AtlasResearchMatch { diseaseIds: string[]; names: string[]; records: AtlasResearchRecord[]; duplicatesRemoved: number }

/** Registry records stay in Clinical Trials; regulatory notices and patient organisations are not research evidence. */
const EXCLUDED_TYPES = /clinicaltrials\.gov registry|regulatory|patient organi[sz]ation/i;

const ids = (url: string) => ({
  pmid: url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/)?.[1] ?? null,
  doi: url.match(/doi\.org\/(10\.[^\s?#]+)/)?.[1]?.toLowerCase() ?? null,
  nct: url.match(/\b(NCT\d{8})\b/i)?.[1]?.toUpperCase() ?? null,
});
export const recordKey = (r: { pmid: string | null; doi: string | null; nct: string | null; url: string }) =>
  r.pmid ? `pmid:${r.pmid}` : r.doi ? `doi:${r.doi}` : r.nct ? `nct:${r.nct}` : `url:${r.url.replace(/\/+$/, "").toLowerCase()}`;

const edgeRefs = (es: Edge[]) => evidenceSources(es).filter((s): s is Source => Boolean(s)).map((s) => s.id);

/** Same source set the pair page builds (map_.pair.$pairId.tsx). */
function pairPageSourceIds(pairId: string): string[] {
  const pair = pairs.find((p) => p.id === pairId)!;
  const c = compare(pair.a, pair.b);
  const A = diseaseMap[pair.a]!, B = diseaseMap[pair.b]!;
  const ledger = [...new Set(strongestPaths(c).flatMap((f) => [...f.pathA, ...f.pathB]))].map((id) => edgeMap[id]).filter(Boolean) as Edge[];
  const qualifying = [...ledger, ...A.edges, ...B.edges].filter((e) => e.contradictions.length || e.polarity !== "support");
  return [
    ...edgeRefs([...ledger, ...qualifying]),
    ...patientExplanation(pair.id).sources,
    ...(caveats[pair.id as keyof typeof caveats] ?? []).flatMap((cv) => cv.sources),
    ...(pair.role === "Exploratory" ? hypotheses().flatMap((h) => h.sources) : []),
  ];
}

/** All Atlas source IDs cited for a curated disease: its own graph edges, then every pair page it appears on. */
export function atlasSourceIdsFor(diseaseId: string): string[] {
  const d = diseaseMap[diseaseId];
  if (!d) return [];
  const out = edgeRefs(d.edges);
  for (const p of pairs) if (p.a === diseaseId || p.b === diseaseId) out.push(...pairPageSourceIds(p.id));
  return [...new Set(out)];
}

/** Atlas research citations for the curated diseases named in the query, deduplicated by PMID/DOI/NCT/URL. */
export function atlasResearchFor(query: string, excludeKeys: Set<string> = new Set()): AtlasResearchMatch | null {
  const diseaseIds = detectAtlasDiseases(query);
  if (!diseaseIds.length) return null;
  const byKey = new Map<string, AtlasResearchRecord>();
  let duplicatesRemoved = 0;
  for (const did of diseaseIds) {
    for (const sid of atlasSourceIdsFor(did)) {
      const s: Source | undefined = sourceMap[sid];
      if (!s || EXCLUDED_TYPES.test(s.type)) continue;
      const rec: AtlasResearchRecord = { id: s.id, title: s.title, type: s.type, year: s.year ?? null, url: s.url, ...ids(s.url), diseases: [did] };
      const key = recordKey(rec);
      const prior = byKey.get(key);
      if (prior) { if (prior.id !== rec.id) duplicatesRemoved++; if (!prior.diseases.includes(did)) prior.diseases.push(did); continue; }
      if (excludeKeys.has(key)) { duplicatesRemoved++; continue; }
      byKey.set(key, rec);
    }
  }
  return { diseaseIds, names: diseaseIds.map((id) => diseaseMap[id]!.name), records: [...byKey.values()], duplicatesRemoved };
}
