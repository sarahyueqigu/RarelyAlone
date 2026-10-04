// Maps live MedlinePlus / ClinicalTrials.gov results into Resources cards.
// Exact source URLs are preserved; anything not exact is dropped (button hidden), never replaced by a homepage.
import type { EducationResource, TrialResource } from "@/data/resources";
import type { EducationResult } from "./medlineplus";
import { ACTIVE_TRIAL_STATUSES, type ClinicalTrialStudy } from "./clinical-trials";

const MEDLINE_HOMEPAGES = new Set(["https://medlineplus.gov/", "https://medlineplus.gov", "https://medlineplus.gov/genetics/", "https://medlineplus.gov/genetics"]);

/** Exact MedlinePlus page URL, or "" when it is missing, off-domain, or just a homepage. */
export function exactMedlineUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !/(^|\.)medlineplus\.gov$/.test(u.hostname)) return "";
  } catch {
    return "";
  }
  return MEDLINE_HOMEPAGES.has(url) ? "" : url;
}

/** Exact study page from the NCT ID, or "" when the ID is not valid. */
export function exactStudyUrl(nctId: string | null | undefined): string {
  return nctId && /^NCT\d{8}$/.test(nctId) ? `https://clinicaltrials.gov/study/${nctId}` : "";
}

export function educationToResource(e: EducationResult, i: number): EducationResource {
  return {
    id: `live-edu-${i}-${e.url}`,
    category: "education",
    title: e.title,
    source: e.sourceName,
    url: exactMedlineUrl(e.url),
    demo: false,
    live: true,
    kind: "published",
    labels: ["Patient-friendly"],
    terms: e.subject ? [e.subject] : [],
    type: e.resourceType,
    summary: e.summary ?? "",
  };
}

export function trialToResource(s: ClinicalTrialStudy, curated = false): TrialResource {
  const active = ACTIVE_TRIAL_STATUSES.has(s.overallStatus ?? "");
  const loc = s.locations[0];
  const location = loc ? [loc.facility, loc.city, loc.country].filter(Boolean).join(", ") : "Not listed";
  return {
    id: `live-trial-${s.nctId}`,
    category: "trials",
    title: s.officialTitle,
    source: `ClinicalTrials.gov · ${s.nctId}`,
    url: exactStudyUrl(s.nctId),
    demo: false,
    live: true,
    kind: "experimental",
    labels: [active ? "Clinical trial" as const : "Completed / non-recruiting clinical study" as const, ...(curated ? ["Cited in curated Atlas evidence" as const] : [])],
    active,
    terms: s.conditions,
    disease: s.conditions.join(", ") || "Not listed",
    intervention: s.interventions.join(", ") || "Not listed",
    status: s.overallStatus ?? "Not listed",
    phase: s.phases.join(", ") || "Not applicable",
    location,
    eligibility: [s.minimumAge && `Min age ${s.minimumAge}`, s.maximumAge && `Max age ${s.maximumAge}`, s.sex && `Sex: ${s.sex}`]
      .filter(Boolean).join(" · "),
  };
}
