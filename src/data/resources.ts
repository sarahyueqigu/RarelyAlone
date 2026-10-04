// Mock/demo dataset for the Resources page. Swap for pipeline data later.
// Only verified real entries with exact URLs remain; live API results fill Education and Trials.

export type Category = "education" | "research" | "trials" | "registries" | "organizations" | "atlas";

export type EvidenceLabel =
  | "Patient-friendly"
  | "Research paper"
  | "Clinical trial"
  | "Completed / non-recruiting clinical study"
  | "Cited in curated Atlas evidence"
  | "Registry"
  | "Patient organization"
  | "Experimental"
  | "Established evidence"
  | "Patient-reported"
  | "Hypothesis";

/** Integrity class: never mixed in one card. */
export type EvidenceKind = "published" | "patient-reported" | "hypothesis" | "experimental";

interface Base {
  id: string;
  category: Category;
  title: string;
  source: string;
  url: string;
  demo: boolean;
  kind: EvidenceKind;
  /** True for results fetched live from an official API (exact URL preserved). */
  live?: boolean;
  /** Broad rare-disease resource (fallback), listed after disease-specific entries. */
  general?: boolean;
  labels: EvidenceLabel[];
  /** Searchable terms: disease, gene, phenotype, mechanism, biomarker, researcher. */
  terms: string[];
}

export interface EducationResource extends Base {
  category: "education";
  summary: string;
  type: string;
}
export interface PaperResource extends Base {
  category: "research";
  authors: string;
  journal: string;
  year: number;
  tags: string[];
  summary: string;
}
export interface TrialResource extends Base {
  category: "trials";
  disease: string;
  intervention: string;
  status: string;
  phase: string;
  location: string;
  eligibility: string;
  /** Open or still-running registry status; false = completed / stopped / unknown. */
  active?: boolean;
}
export interface OrgResource extends Base {
  category: "registries" | "organizations";
  focus: string;
  purpose: string;
  scope: string;
}
export interface AtlasResource extends Base {
  category: "atlas";
  resourceType: string;
  why: string;
  trigger: string;
  evidenceType: string;
}

export type Resource = EducationResource | PaperResource | TrialResource | OrgResource | AtlasResource;

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "education", label: "Patient Education" },
  { id: "research", label: "Research" },
  { id: "trials", label: "Clinical Trials" },
  { id: "registries", label: "Registries & Patient Organizations" },
  { id: "atlas", label: "Atlas-Connected Resources" },
];

export const SEARCH_FIELDS = ["disease", "gene", "phenotype", "mechanism", "biomarker", "researcher"];

export const ATLAS_CALLOUT =
  "Because Tay-Sachs and Sandhoff are connected through GM2 ganglioside accumulation, these resources may be relevant.";

export const RESOURCES: Resource[] = [
  // Patient education: exact resource pages only — never a publisher homepage.
  {
    id: "edu-medlineplus", category: "education", title: "Tay-Sachs disease: plain-language overview",
    source: "NIH / MedlinePlus Genetics", url: "https://medlineplus.gov/genetics/condition/tay-sachs-disease/", demo: false, kind: "published",
    type: "Condition guide", labels: ["Patient-friendly", "Established evidence"],
    summary: "What the condition is, how it is inherited, and which gene is involved, written for families.",
    terms: ["Tay-Sachs", "HEXA", "GM2 gangliosidosis", "lysosomal storage"],
  },

  // Registries
  {
    id: "reg-orphanet", category: "registries", title: "Orphanet", source: "Orphanet", url: "https://www.orpha.net/", general: true,
    demo: false, kind: "published", focus: "All rare diseases", scope: "International (Europe-based)",
    purpose: "Reference portal listing diseases, expert centres, registries, and research projects.",
    labels: ["Registry", "Established evidence"], terms: ["Tay-Sachs", "Sandhoff", "Gaucher", "Niemann-Pick type C", "SPG11"],
  },

  // Organizations
  {
    id: "org-nord", category: "organizations", title: "NORD (National Organization for Rare Disorders)",
    source: "NORD", url: "https://rarediseases.org/", general: true, demo: false, kind: "published",
    focus: "All rare diseases", scope: "United States",
    purpose: "Disease reports, patient assistance programs, and a directory of member organizations.",
    labels: ["Patient organization", "Patient-friendly"], terms: ["Tay-Sachs", "Sandhoff", "Gaucher", "Niemann-Pick type C", "SPG11"],
  },
];

export const COMING_SOON = { title: "Patient Stories", text: "Personal stories, kept separate from clinical evidence. Coming in a later release." };

export function searchResources(list: Resource[], query: string, cats: Category[]): Resource[] {
  const q = query.trim().toLowerCase();
  return list.filter((r) => {
    if (cats.length && !cats.includes(r.category)) return false;
    if (!q) return true;
    const hay = [r.title, r.source, ...r.terms, ...("tags" in r ? r.tags : []), ...("authors" in r ? [r.authors] : [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
