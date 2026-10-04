// Evidence retrieval + filtering for Ask Rarely Alone. Pure, testable; reuses the Resources aggregator.
import { searchResourcesAggregate, type ResourcesSearchResult } from "./resources-search";
import { diseaseTerms, scoreEducation, scoreTrial, STRONG_TRIAL } from "./resources-relevance";

export interface EvidenceSource {
  id: string; // S1, S2, ...
  kind: "education" | "trial" | "atlas" | "research";
  title: string;
  sourceName: string;
  url: string;
  /** Text given to the model: only what the source itself provided. */
  text: string;
}

export interface RetrievedEvidence {
  diseases: { name: string; orphaCode: number }[];
  sources: EvidenceSource[];
  failedSources: string[];
}

const QUESTION_WORDS = new Set(
  "what does do did why are is was there any how can could would should will people person with have has had having the a an of in on for to about involving involve studies study trials trial research related relate relation connected between me my i you tell explain mean means".split(" "),
);

/** Split a question into up to 2 disease-oriented search phrases. Deterministic. */
export function questionToQueries(question: string): string[] {
  const parts = question
    .replace(/[?!.]+/g, " ")
    .split(/\s+(?:and|vs\.?|versus|or)\s+|,/i)
    .map((p) =>
      p.split(/\s+/).filter((w) => w && !QUESTION_WORDS.has(w.toLowerCase())).join(" ").trim(),
    )
    .filter((p) => p.length >= 2);
  return [...new Set(parts)].slice(0, 2);
}

/** Keep only results relevant to the recognized disease; studies must be strong (disease-directed), not broad lists. */
export function filterRelevant(r: ResourcesSearchResult): { education: ResourcesSearchResult["patientEducation"]; trials: ResourcesSearchResult["clinicalTrials"] } {
  const d = r.normalizedDisease;
  if (!d) return { education: [], trials: [] }; // no recognized disease: nothing is reliably relevant
  const t = diseaseTerms(d);
  return {
    education: r.patientEducation.filter((e) => scoreEducation(e, t) > 0),
    trials: r.clinicalTrials.filter((s) => scoreTrial(s, t) >= STRONG_TRIAL),
  };
}

export const REFERENTIAL = /\b(these|this|those|that|it|its|they|them|their|same|the (?:disease|condition|gene|sources?))\b/i;
const nameTokens = (n: string) => n.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !["disease", "type", "syndrome"].includes(w));

/** Context diseases to reuse: ones the question mentions by name, or all of them for a referential follow-up. */
export function contextToReuse(question: string, context: string[], recognized: string[]): string[] {
  const q = ` ${question.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const fresh = context.filter((c) => !recognized.some((r) => r.toLowerCase() === c.toLowerCase()));
  const mentioned = fresh.filter((c) => nameTokens(c).some((w) => q.includes(` ${w} `)));
  if (mentioned.length) return mentioned;
  // A new explicit entity wins; otherwise only a clearly referential follow-up reuses context.
  return !recognized.length && REFERENTIAL.test(question) ? fresh : [];
}

const clip = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : "");

export async function retrieveEvidence(
  question: string,
  search: typeof searchResourcesAggregate = searchResourcesAggregate,
  context: string[] = [],
): Promise<RetrievedEvidence> {
  const queries = questionToQueries(question);
  const results = await Promise.all(queries.map((q) => search(q)));
  const recognizedNow = results.flatMap((r) => (r.normalizedDisease ? [r.normalizedDisease.preferredName] : []));
  const reuse = contextToReuse(question, context, recognizedNow).slice(0, 2);
  if (reuse.length) results.push(...(await Promise.all(reuse.map((c) => search(c)))));
  const seen = new Set<string>();
  const sources: EvidenceSource[] = [];
  const diseases: RetrievedEvidence["diseases"] = [];
  const failed = new Set<string>();
  for (const r of results) {
    r.errors.forEach((e) => failed.add(e.source));
    if (r.normalizedDisease && !diseases.some((x) => x.orphaCode === r.normalizedDisease!.orphaCode)) {
      diseases.push({ name: r.normalizedDisease.preferredName, orphaCode: r.normalizedDisease.orphaCode });
    }
    const { education, trials } = filterRelevant(r);
    for (const e of education) {
      if (!e.url || seen.has(e.url)) continue;
      seen.add(e.url);
      sources.push({ id: "", kind: "education", title: e.title, sourceName: e.sourceName, url: e.url, text: clip(e.summary, 700) });
    }
    for (const s of trials.slice(0, 4)) {
      if (!s.url || seen.has(s.url)) continue;
      seen.add(s.url);
      sources.push({
        id: "", kind: "trial", title: s.officialTitle, sourceName: `ClinicalTrials.gov ${s.nctId}`, url: s.url,
        text: [`Conditions: ${s.conditions.join(", ")}`, `Interventions: ${s.interventions.join(", ") || "not listed"}`,
          `Status: ${s.overallStatus ?? "not listed"}`, `Phase: ${s.phases.join(", ") || "n/a"}`, clip(s.briefSummary, 400)].join(". "),
      });
    }
  }
  const capped = sources.slice(0, 14).map((s, i) => ({ ...s, id: `S${i + 1}` }));
  return { diseases, sources: capped, failedSources: [...failed] };
}

/** Keep only IDs that were actually supplied. */
export function validSourceIds(ids: string[], sources: EvidenceSource[]): string[] {
  const allowed = new Set(sources.map((s) => s.id));
  return [...new Set(ids.filter((id) => allowed.has(id)))];
}
