// Server-only access to the attached rare-disease dataset (PubMed + NIH RePORTER metadata).
// Data is used as-is: nothing is generated or filled in.
import raw from "@/data/rarediseases.json";
import type { EvidenceSource } from "./ask-evidence";

export interface PubmedArticle {
  pmid: string; title: string; journal: string | null; pubDate: string | null; year: number | null;
  authors: string[]; authorCount: number; publicationTypes: string[]; doi: string | null; pmcid: string | null; url: string;
}
export interface NihProject {
  coreProjectNum: string; title: string; status: string; relevance: string; fiscalYears: number[]; totalAwardAmount: number;
  projectStartDate: string | null; projectEndDate: string | null; institute: string | null; organization: string | null;
  principalInvestigators: string[]; url: string;
}
interface Pubmed { pubmedUrl: string; count: number; reviewCount: number; firstYear: number | null; latestYear: number | null; recentArticles: PubmedArticle[] }
interface Nih { reporterUrl: string; hasFunding: boolean; summary: { ongoing: { projects: number }; past: { projects: number } }; ongoing: NihProject[]; past: NihProject[] }
interface DatasetDisease { name: string; synonyms: string[]; nord?: { url?: string } | null; pubmed?: Pubmed | null; nihFunding?: Nih | null }

const diseases = (raw as unknown as { diseases: DatasetDisease[] }).diseases;

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
/** Short synonyms (e.g. "NS") are too ambiguous; keep ones of 4+ chars, or 3 chars containing a digit (NF1). */
const usableSyn = (s: string) => s.length >= 4 || (s.length === 3 && /\d/.test(s));

/** Diseases whose name or a usable synonym appears as a whole phrase in the text. */
export function findDatasetDiseases(text: string, limit = 2): DatasetDisease[] {
  const t = norm(text);
  return diseases.filter((d) => [d.name, ...d.synonyms.filter(usableSyn)].some((n) => norm(n).trim() && t.includes(norm(n)))).slice(0, limit);
}

export interface ResearchMatch {
  name: string;
  nordUrl: string | null;
  pubmed: Pubmed | null;
  nih: { reporterUrl: string; ongoingCount: number; pastCount: number; projects: NihProject[] } | null;
}

/** Resources search: match a query to dataset diseases (name/synonym phrase either way). */
export function researchFor(query: string): ResearchMatch[] {
  const q = norm(query);
  if (q.trim().length < 2) return [];
  const hits = diseases.filter((d) => [d.name, ...d.synonyms.filter(usableSyn)].some((n) => { const x = norm(n); return q.includes(x) || (q.trim().length >= 4 && x.includes(q)); }));
  return hits.slice(0, 3).map((d) => ({
    name: d.name,
    nordUrl: d.nord?.url ?? null,
    pubmed: d.pubmed ?? null,
    nih: d.nihFunding ? {
      reporterUrl: d.nihFunding.reporterUrl,
      ongoingCount: d.nihFunding.summary.ongoing.projects,
      pastCount: d.nihFunding.summary.past.projects,
      projects: [...d.nihFunding.ongoing, ...d.nihFunding.past].slice(0, 4),
    } : null,
  }));
}

/** Ask evidence from the dataset: recent PubMed articles and NIH projects (metadata only, no abstracts). */
export function datasetEvidence(text: string): { names: string[]; sources: EvidenceSource[] } {
  const found = findDatasetDiseases(text);
  const sources: EvidenceSource[] = [];
  for (const d of found) {
    const p = d.pubmed;
    if (p) {
      sources.push({ id: "", kind: "research", title: `PubMed literature on ${d.name}`, sourceName: "PubMed", url: p.pubmedUrl,
        text: `PubMed search for ${d.name}: ${p.count} articles, ${p.reviewCount} reviews, published ${p.firstYear ?? "?"}–${p.latestYear ?? "?"}.` });
      for (const a of p.recentArticles.slice(0, 4)) {
        sources.push({ id: "", kind: "research", title: a.title, sourceName: `PubMed PMID ${a.pmid}`, url: a.url,
          text: `Article about ${d.name}. Journal: ${a.journal ?? "not listed"}. Date: ${a.pubDate ?? a.year ?? "not listed"}. Type: ${a.publicationTypes.join(", ") || "not listed"}. Title only; no abstract supplied.` });
      }
    }
    const n = d.nihFunding;
    if (n?.hasFunding) {
      for (const pr of [...n.ongoing, ...n.past].slice(0, 3)) {
        sources.push({ id: "", kind: "research", title: pr.title, sourceName: `NIH RePORTER ${pr.coreProjectNum}`, url: pr.url,
          text: `NIH-funded project (${pr.status}) that ${pr.relevance === "focus" ? "names" : "mentions"} ${d.name}. Institute: ${pr.institute ?? "n/a"}. Organization: ${pr.organization ?? "n/a"}. Fiscal years: ${pr.fiscalYears.join(", ")}.` });
      }
    }
  }
  return { names: found.map((d) => d.name), sources };
}
