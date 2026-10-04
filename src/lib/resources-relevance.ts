// Generic relevance scoring for live Resources results. Pure + deterministic.
// A result must mention the recognized disease (name, synonym, group) or one of its genes to be kept.
import type { OrphaDisease } from "./orphadata";
import type { EducationResult } from "./medlineplus";
import type { ClinicalTrialStudy } from "./clinical-trials";

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

export interface DiseaseTerms { names: string[]; genes: string[] }

export function diseaseTerms(d: Pick<OrphaDisease, "preferredName" | "synonyms" | "genes">): DiseaseTerms {
  const base = d.preferredName.replace(/\b(disease|syndrome|disorder)\b/gi, "").trim();
  const names = [d.preferredName, base, ...(d.synonyms ?? [])]
    .map((t) => norm(t).trim()).filter((t) => t.length >= 4);
  const genes = (d.genes ?? []).map((g) => norm(g.symbol).trim()).filter((t) => t.length >= 3);
  return { names: [...new Set(names)], genes: [...new Set(genes)] };
}

const has = (text: string, terms: string[]) => { const t = norm(text); return terms.some((x) => t.includes(` ${x} `)); };

/** 0 = exclude. Disease page > gene page > symptom page that mentions the disease/gene in its text. */
export function scoreEducation(e: EducationResult, t: DiseaseTerms): number {
  const head = `${e.title} ${e.subject ?? ""}`;
  if (has(head, t.names)) return 3;
  if (has(head, t.genes)) return 2;
  if (has(e.summary ?? "", t.names) || has(e.summary ?? "", t.genes)) return 1;
  return 0;
}

/** Higher = more directly about the disease. <=0 excluded; 1 = weak (broad multi-condition study). */
export function scoreTrial(s: ClinicalTrialStudy, t: DiseaseTerms): number {
  const all = [...t.names, ...t.genes];
  const inTitle = has(s.officialTitle, all);
  const condHits = s.conditions.filter((c) => has(c, all)).length;
  if (!inTitle && !condHits) return 0;
  let score = (inTitle ? 3 : 0) + (condHits ? 2 : 0) + (has(s.interventions.join(" "), all) ? 1 : 0);
  // Disease listed among many unrelated conditions, not named in the title: broad study.
  const broad = !inTitle && s.conditions.length > 3 && condHits / s.conditions.length < 0.5;
  if (broad) score = 1;
  return score;
}

export const STRONG_TRIAL = 2;

export function rankEducation(items: EducationResult[], d: OrphaDisease): EducationResult[] {
  const t = diseaseTerms(d);
  return items.map((e, i) => ({ e, i, s: scoreEducation(e, t) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.e);
}

/** Strong studies first; weak broad ones only fill remaining slots. */
export function rankTrials(items: ClinicalTrialStudy[], d: OrphaDisease, max = 5): ClinicalTrialStudy[] {
  const t = diseaseTerms(d);
  const scored = items.map((s, i) => ({ s, i, v: scoreTrial(s, t) })).filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v || a.i - b.i);
  return scored.slice(0, max).map((x) => x.s);
}

export function isStrongTrial(s: ClinicalTrialStudy, d: OrphaDisease): boolean {
  return scoreTrial(s, diseaseTerms(d)) >= STRONG_TRIAL;
}
