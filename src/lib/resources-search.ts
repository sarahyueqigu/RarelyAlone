// Resources search aggregator: Orphadata (disease) -> MedlinePlus + ClinicalTrials.gov.
// Reuses the existing services; never invents results; exact source URLs preserved.
import { rankEducation, rankTrials } from "./resources-relevance";
import { extractQuery } from "./query-interpret";
import { normalizeRareDisease, looksLikeGeneSymbol, type OrphaDisease } from "./orphadata";
import { lookupPatientEducation, type EducationResult } from "./medlineplus";
import { searchClinicalTrials, fetchClinicalTrialById, type ClinicalTrialStudy } from "./clinical-trials";
import { curatedTrialIds, detectAtlasDiseases } from "./ask-atlas";

/** Explicit demo abbreviations Orphadata can't resolve. No fuzzy expansion. */
export const DEMO_ALIASES: Record<string, string> = {
  NPC: "Niemann-Pick disease type C",
  SPG11: "Spastic paraplegia type 11",
  AIP: "Acute intermittent porphyria",
};

export type SourceName = "Orphadata" | "MedlinePlus" | "ClinicalTrials.gov";
export interface SourceError { source: SourceName; message: string }

export interface ResourcesSearchResult {
  originalQuery: string;
  normalizedDisease: OrphaDisease | null;
  searchTerms: {
    /** Words in the query that identified the disease (after alias expansion). */
    diseaseTerm: string | null;
    /** Remaining symptom / gene words kept from the query. */
    extraTerms: string[];
    /** Queries actually sent downstream. */
    medlinePlusQueries: string[];
    clinicalTrialsQuery: string | null;
  };
  patientEducation: EducationResult[];
  clinicalTrials: ClinicalTrialStudy[];
  /** NCT IDs added by exact lookup because the curated Atlas cites them for the searched disease. */
  curatedTrialIds?: string[];
  /** Number of duplicate results removed (same URL). */
  duplicatesRemoved: number;
  errors: SourceError[];
}

export interface AggregatorDeps {
  normalize?: typeof normalizeRareDisease;
  education?: typeof lookupPatientEducation;
  trials?: typeof searchClinicalTrials;
  trialById?: typeof fetchClinicalTrialById;
}

/** Expand explicit alias tokens (case-insensitive whole-word match; no fuzzy expansion). */
export function expandAliases(query: string): string {
  // Spelling variants of SPG11 ("SPG 11", "SPG-11", "(autosomal recessive) spastic paraplegia type 11") collapse to one token first.
  const q = query.replace(/\b(?:autosomal recessive\s+)?spastic paraplegia(?:\s+type)?\s*11\b/gi, "SPG11").replace(/\bspg[\s-]+11\b/gi, "SPG11");
  return q.trim().split(/\s+/).map((w) => DEMO_ALIASES[w.toUpperCase()] ?? w).join(" ");
}

export function dedupeByUrl<T extends { url: string }>(items: T[]): { items: T[]; removed: number } {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = it.url.trim().replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return { items: out, removed: items.length - out.length };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function searchResourcesAggregate(query: string, deps: AggregatorDeps = {}): Promise<ResourcesSearchResult> {
  const normalize = deps.normalize ?? normalizeRareDisease;
  const education = deps.education ?? lookupPatientEducation;
  const trials = deps.trials ?? searchClinicalTrials;
  const originalQuery = query;
  const errors: SourceError[] = [];
  const words = expandAliases(extractQuery(query)).split(/\s+/).filter(Boolean);

  // Longest leading phrase that Orphadata resolves is the disease; the rest are extra terms.
  let disease: OrphaDisease | null = null;
  let used = 0;
  try {
    for (let n = words.length; n >= 1 && !disease; n--) {
      const phrase = words.slice(0, n).join(" ");
      // Single tokens: try the canonical uppercase gene symbol first (hexb -> HEXB), generically.
      const upper = phrase.toUpperCase();
      if (n === 1 && upper !== phrase && looksLikeGeneSymbol(upper)) {
        disease = await normalize(upper);
        if (disease) { words[0] = upper; used = 1; break; }
      }
      disease = await normalize(phrase);
      if (disease) used = n;
    }
  } catch (e) {
    errors.push({ source: "Orphadata", message: msg(e) });
  }
  const diseaseTerm = disease ? words.slice(0, used).join(" ") : null;
  const extraTerms = disease ? words.slice(used) : words;
  const geneQuery = diseaseTerm && looksLikeGeneSymbol(diseaseTerm) ? diseaseTerm : null;

  const base = disease?.preferredName ?? (words.join(" ") || null);
  const medlinePlusQueries = [
    ...(base ? [base] : []),
    ...(geneQuery ? [geneQuery] : []),
    ...(disease && extraTerms.length ? [extraTerms.join(" ")] : []),
  ].filter((q, i, a) => a.indexOf(q) === i);
  const clinicalTrialsQuery = base;

  const [edu, tri] = await Promise.allSettled([
    Promise.all(medlinePlusQueries.map((q) => education(q))),
    clinicalTrialsQuery ? trials(clinicalTrialsQuery, disease ? { pageSize: 12 } : undefined) : Promise.resolve([]),
  ]);
  if (edu.status === "rejected") errors.push({ source: "MedlinePlus", message: msg(edu.reason) });
  if (tri.status === "rejected") errors.push({ source: "ClinicalTrials.gov", message: msg(tri.reason) });

  const e = dedupeByUrl(edu.status === "fulfilled" ? edu.value.flat() : []);
  const t = dedupeByUrl(tri.status === "fulfilled" ? tri.value : []);
  // Curated Atlas registry records the disease-name query missed are fetched by exact NCT ID (real records only).
  const byId = deps.trialById ?? (deps.trials ? async () => null : fetchClinicalTrialById);
  const have = new Set(t.items.map((s) => s.nctId));
  const missing = curatedTrialIds(detectAtlasDiseases(words.join(" "))).filter((id) => !have.has(id));
  const added: string[] = [];
  const curated: ClinicalTrialStudy[] = [];
  if (missing.length) {
    const got = await Promise.allSettled(missing.map((id) => byId(id)));
    for (const g of got) if (g.status === "fulfilled" && g.value) { curated.push(g.value); added.push(g.value.nctId); }
    if (got.some((g) => g.status === "rejected") && !errors.some((x) => x.source === "ClinicalTrials.gov")) errors.push({ source: "ClinicalTrials.gov", message: "Exact study lookup failed" });
  }
  // With a recognized disease, keep only results that mention it (or its genes), most relevant first.
  if (disease) { e.items = rankEducation(e.items, disease); t.items = rankTrials(t.items, disease, 5); }
  // Curated records are disease-linked by the Atlas itself, so they bypass the name-match filter.
  t.items.push(...curated);

  return {
    originalQuery,
    normalizedDisease: disease,
    searchTerms: { diseaseTerm, extraTerms, medlinePlusQueries, clinicalTrialsQuery },
    patientEducation: e.items,
    clinicalTrials: t.items,
    curatedTrialIds: added,
    duplicatesRemoved: e.removed + t.removed,
    errors,
  };
}
