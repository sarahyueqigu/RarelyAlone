// Server-only: turns one disease record from the rare-disease dataset into an action view for Find My Circle (search).
// Uses the file as-is; nothing is generated. Overlaps are flagged from title similarity only and labelled as "possible".
import raw from "@/data/rarediseases.json";

/* eslint-disable @typescript-eslint/no-explicit-any */
const diseases = (raw as any).diseases as any[];
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export interface DiseaseOption { name: string; synonyms: string[]; ongoingTrials: number }
export function listDiseases(): DiseaseOption[] {
  return diseases.map((d) => ({ name: d.name, synonyms: arr(d.synonyms), ongoingTrials: arr(d.clinicalTrials?.ongoing).length }));
}

export interface Trial { nctId: string; title: string; status: string; studyType: string | null; phases: string[]; sponsor: string | null; start: string | null; completion: string | null; enrollment: number | null; conditions: string[]; url: string }
export interface Project { id: string; title: string; status: string; focus: boolean; organization: string | null; location: string | null; institute: string | null; pis: string[]; years: number[]; amount: number | null; url: string }
export interface DirEntry { name: string; url: string | null; detail: string | null }
export interface DirGroup { key: string; label: string; entries: DirEntry[] }
export interface Overlap { reason: string; items: { kind: "trial" | "project"; id: string; title: string; url: string }[] }
export interface Contact { name: string; role: string; organization: string | null; location: string | null; via: string; url: string }

const trial = (t: any): Trial => ({
  nctId: t.nctId, title: s(t.title) ?? t.nctId, status: s(t.status) ?? "UNKNOWN", studyType: s(t.studyType), phases: arr(t.phases).filter((p) => p && p !== "NA"),
  sponsor: s(t.leadSponsor), start: s(t.startDate), completion: s(t.completionDate), enrollment: typeof t.enrollment === "number" ? t.enrollment : null,
  conditions: arr(t.conditions), url: s(t.url) ?? `https://clinicaltrials.gov/study/${t.nctId}`,
});
const project = (p: any): Project => ({
  id: p.coreProjectNum, title: s(p.title) ?? p.coreProjectNum, status: s(p.status) ?? "", focus: p.relevance === "focus", organization: s(p.organization), location: s(p.location),
  institute: s(p.institute), pis: arr(p.principalInvestigators), years: arr(p.fiscalYears), amount: typeof p.totalAwardAmount === "number" ? p.totalAwardAmount : null, url: s(p.url) ?? "",
});

// Orphanet directory groups (only rendered when the record actually has orphanetDirectories).
const DIR_LABELS: [RegExp, string][] = [
  [/patient|communit|organi[sz]ation|support/i, "Patient communities"],
  [/federation|alliance|umbrella/i, "Federations & alliances"],
  [/expert|centre|center|clinic/i, "Expert centres"],
  [/ern|reference.?network/i, "European Reference Networks"],
  [/registr/i, "Patient registries"],
  [/biobank/i, "Biobanks"],
  [/research|project/i, "Research projects"],
  [/trial/i, "Clinical trials (Orphanet)"],
];
function directories(d: any): DirGroup[] | null {
  const od = d.orphanetDirectories;
  if (!od || typeof od !== "object") return null;
  return Object.entries(od).map(([key, v]: [string, any]) => {
    const list = Array.isArray(v) ? v : arr(v?.items ?? v?.entries ?? v?.results);
    return {
      key, label: DIR_LABELS.find(([re]) => re.test(key))?.[1] ?? key,
      entries: list.map((e: any) => (typeof e === "string" ? { name: e, url: null, detail: null } : {
        name: s(e.name) ?? s(e.title) ?? s(e.label) ?? "Unnamed entry",
        url: s(e.url) ?? s(e.website) ?? s(e.link),
        detail: [s(e.city), s(e.country), s(e.type), s(e.contact)].filter(Boolean).join(" · ") || null,
      })),
    };
  }).filter((g) => g.entries.length);
}

const STOP = new Set("a an and of the in for to with on by at or study trial phase patients patient children adults subjects participants evaluate evaluating efficacy safety open label randomized".split(" "));
const tokens = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };

function overlaps(trials: Trial[], projects: Project[]): Overlap[] {
  const items = [
    ...trials.map((t) => ({ kind: "trial" as const, id: t.nctId, title: t.title, url: t.url, tk: tokens(t.title) })),
    ...projects.map((p) => ({ kind: "project" as const, id: p.id, title: p.title, url: p.url, tk: tokens(p.title) })),
  ].filter((x) => x.tk.size >= 3);
  const used = new Set<number>(); const out: Overlap[] = [];
  for (let i = 0; i < items.length && out.length < 8; i++) {
    if (used.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < items.length; j++) if (!used.has(j) && jaccard(items[i]!.tk, items[j]!.tk) >= 0.6) group.push(j);
    if (group.length > 1) {
      group.forEach((g) => used.add(g));
      out.push({ reason: "Very similar titles — check whether these efforts duplicate each other before starting or funding another.", items: group.map((g) => { const { tk: _t, ...rest } = items[g]!; return rest; }) });
    }
  }
  return out;
}

const ACTIVE = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION", "ACTIVE_NOT_RECRUITING", "AVAILABLE"]);

export function diseaseProfile(name: string) {
  const d = diseases.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!d) return null;
  const ct = d.clinicalTrials ?? {};
  const ongoing = arr(ct.ongoing).map(trial), completed = arr(ct.completed).map(trial), stopped = arr(ct.stoppedOrUnknown).map(trial);
  const nih = d.nihFunding ?? {};
  const nOngoing = arr(nih.ongoing).map(project), nPast = arr(nih.past).map(project);
  const g = d.geneVariantMechanism ?? {};
  const pm = d.pubmed ?? {};
  const recruiting = ongoing.filter((t) => ["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"].includes(t.status));
  // People/places to contact: named PIs on ongoing NIH projects (public record) and lead sponsors of open trials.
  const contacts: Contact[] = [];
  for (const p of nOngoing.filter((p) => p.focus).concat(nOngoing.filter((p) => !p.focus))) for (const pi of p.pis) {
    if (contacts.length >= 12 || contacts.some((c) => c.name === pi)) continue;
    contacts.push({ name: pi, role: `Principal investigator${p.focus ? " (project focuses on this disease)" : " (project mentions this disease)"}`, organization: p.organization, location: p.location, via: `NIH RePORTER ${p.id}`, url: p.url });
  }
  const sponsors = new Map<string, Trial[]>();
  for (const t of recruiting) if (t.sponsor) sponsors.set(t.sponsor, [...(sponsors.get(t.sponsor) ?? []), t]);
  return {
    name: d.name,
    synonyms: arr(d.synonyms),
    links: {
      nord: s(d.nord?.url), orphanet: s(d.orphanet?.url), gard: s(d.gard?.url), omim: s(d.omim?.url),
    },
    gene: g.gene ? { symbol: g.gene.symbol, name: s(g.gene.name), inheritance: s(g.gene.inheritance), location: s(g.gene.cytoLocation) } : null,
    otherGenes: arr(g.otherGenes).map((x: any) => (typeof x === "string" ? x : x?.symbol)).filter(Boolean) as string[],
    mechanism: s(g.mechanism), mechanismBasis: s(g.basis),
    trials: { ongoing, completed, stopped, searchUrl: s(ct.apiUrl) },
    activeCount: ongoing.filter((t) => ACTIVE.has(t.status)).length,
    recruiting,
    sponsors: [...sponsors.entries()].map(([name, ts]) => ({ name, trials: ts.map((t) => ({ nctId: t.nctId, url: t.url, title: t.title })) })),
    projects: { ongoing: nOngoing, past: nPast, reporterUrl: s(nih.reporterUrl), ongoingAmount: nih.summary?.ongoing?.totalAwardAmount ?? null },
    pubmed: { count: pm.count ?? 0, reviews: pm.reviewCount ?? 0, first: pm.firstYear ?? null, latest: pm.latestYear ?? null, url: s(pm.pubmedUrl), articles: arr(pm.recentArticles).slice(0, 5).map((a: any) => ({ pmid: a.pmid, title: a.title, journal: s(a.journal), year: a.year ?? null, url: a.url })) },
    directories: directories(d),
    overlaps: overlaps([...ongoing, ...completed, ...stopped], [...nOngoing, ...nPast]),
    contacts,
  };
}
export type DiseaseProfile = NonNullable<ReturnType<typeof diseaseProfile>>;
