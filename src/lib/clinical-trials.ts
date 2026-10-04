// Reusable client for the official ClinicalTrials.gov API (v2).
// Returns only real studies from the API — never invents fallback records.

const API_BASE = "https://clinicaltrials.gov/api/v2/studies";

export interface TrialLocation {
  facility: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface ClinicalTrialStudy {
  nctId: string;
  officialTitle: string;
  briefSummary: string | null;
  conditions: string[];
  interventions: string[];
  overallStatus: string | null;
  studyType: string | null;
  phases: string[];
  minimumAge: string | null;
  maximumAge: string | null;
  sex: string | null;
  locations: TrialLocation[];
  leadSponsor: string | null;
  startDate: string | null;
  completionDate: string | null;
  lastUpdateDate: string | null;
  url: string;
}

export interface SearchTrialsOptions {
  pageSize?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const arr = <T = any>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normalizeStudy(raw: any): ClinicalTrialStudy | null {
  const p = raw?.protocolSection ?? {};
  const id = p.identificationModule ?? {};
  const nctId = str(id.nctId);
  if (!nctId) return null;
  const status = p.statusModule ?? {};
  const design = p.designModule ?? {};
  const elig = p.eligibilityModule ?? {};
  const phases = arr<string>(design.phases).filter((x) => x && x !== "NA");
  return {
    nctId,
    officialTitle: str(id.officialTitle) ?? str(id.briefTitle) ?? nctId,
    briefSummary: str(p.descriptionModule?.briefSummary),
    conditions: arr<string>(p.conditionsModule?.conditions).filter(Boolean),
    interventions: arr<any>(p.armsInterventionsModule?.interventions)
      .map((i) => str(i?.name))
      .filter((x): x is string => !!x),
    overallStatus: str(status.overallStatus),
    studyType: str(design.studyType),
    phases,
    minimumAge: str(elig.minimumAge),
    maximumAge: str(elig.maximumAge),
    sex: str(elig.sex),
    locations: arr<any>(p.contactsLocationsModule?.locations).map((l) => ({
      facility: str(l?.facility),
      city: str(l?.city),
      state: str(l?.state),
      country: str(l?.country),
    })),
    leadSponsor: str(p.sponsorCollaboratorsModule?.leadSponsor?.name),
    startDate: str(status.startDateStruct?.date),
    completionDate: str(status.completionDateStruct?.date),
    lastUpdateDate: str(status.lastUpdatePostDateStruct?.date),
    url: `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`,
  };
}

export async function searchClinicalTrials(
  query: string,
  { pageSize = 5, fetchImpl = fetch, signal }: SearchTrialsOptions = {},
): Promise<ClinicalTrialStudy[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    "query.cond": q,
    pageSize: String(Math.min(Math.max(pageSize, 1), 100)),
    format: "json",
  });
  const res = await fetchImpl(`${API_BASE}?${params}`, {
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  });
  if (!res.ok) throw new Error(`ClinicalTrials.gov request failed (${res.status})`);
  const body: any = await res.json();
  return arr(body?.studies)
    .map(normalizeStudy)
    .filter((s): s is ClinicalTrialStudy => s !== null);
}

/** Exact lookup of one registry record by NCT ID; null when the ID is invalid or not found. */
export async function fetchClinicalTrialById(
  nctId: string,
  { fetchImpl = fetch, signal }: SearchTrialsOptions = {},
): Promise<ClinicalTrialStudy | null> {
  if (!/^NCT\d{8}$/.test(nctId)) return null;
  const res = await fetchImpl(`${API_BASE}/${nctId}?format=json`, {
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ClinicalTrials.gov request failed (${res.status})`);
  return normalizeStudy(await res.json());
}

/** Registry statuses that mean a study is open or still running (vs. completed / stopped). */
export const ACTIVE_TRIAL_STATUSES = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION", "ACTIVE_NOT_RECRUITING", "AVAILABLE"]);
