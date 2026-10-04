// Reusable patient-education lookup using official MedlinePlus (NLM/NIH) sources:
//  - MedlinePlus Web Service (health topics search): https://wsearch.nlm.nih.gov/ws/query
//  - MedlinePlus Genetics data files: https://medlineplus.gov/about/data-files-api
// Returns only what these sources provide. No invented summaries, URLs or fallbacks.

export type EducationResourceType = "condition" | "gene" | "medication" | "patient education";

export interface EducationResult {
  title: string;
  sourceName: string;
  resourceType: EducationResourceType;
  /** Disease or gene name, when the source identifies it. */
  subject: string | null;
  /** First paragraph of the source's own text, tags stripped. */
  summary: string | null;
  url: string;
  lastUpdated: string | null;
}

export interface EducationLookupOptions {
  maxHealthTopics?: number;
  fetchImpl?: typeof fetch;
}

const WS = "https://wsearch.nlm.nih.gov/ws/query";
const GENETICS = "https://medlineplus.gov/download/genetics";
const OFFICIAL_HOST = /^https:\/\/(\w+\.)?medlineplus\.gov\//;

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;|\u00a0/g, " ").replace(/&amp;/g, "&");

/** Strip HTML and return the first non-empty paragraph, or null. */
export function firstParagraph(html: string | null | undefined): string | null {
  if (!html) return null;
  const paras = decode(html).split(/<\/p>/i);
  for (const p of paras) {
    const t = p.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  return null;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Parse MedlinePlus Web Service XML (regex-based so it runs on server and edge). */
export function parseHealthTopicsXml(xml: string, max: number): EducationResult[] {
  const out: EducationResult[] = [];
  const docRe = /<document[^>]*\burl="([^"]+)"[^>]*>([\s\S]*?)<\/document>/g;
  let m: RegExpExecArray | null;
  while ((m = docRe.exec(xml)) && out.length < max) {
    const url = decode(m[1]!);
    if (!OFFICIAL_HOST.test(url)) continue;
    const field = (name: string) => {
      const r = new RegExp(`<content name="${name}">([\\s\\S]*?)</content>`).exec(m![2]!);
      return r ? r[1]! : null;
    };
    const title = firstParagraph(field("title"));
    if (!title) continue;
    out.push({
      title,
      sourceName: firstParagraph(field("organizationName")) ?? "MedlinePlus",
      resourceType: /\/druginfo\//.test(url) ? "medication" : "patient education",
      subject: title,
      summary: firstParagraph(field("FullSummary")) ?? firstParagraph(field("snippet")),
      url,
      lastUpdated: null, // the web service does not report a date
    });
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeGenetics(d: any, kind: "condition" | "gene"): EducationResult | null {
  const url = str(d?.["ghr-page"]) ?? str(d?.ghr_page);
  const name = str(d?.name);
  if (!url || !name || !OFFICIAL_HOST.test(url)) return null;
  const symbol = str(d?.["gene-symbol"]);
  const texts: any[] = Array.isArray(d?.["text-list"]) ? d["text-list"] : [];
  const html = texts.map((t) => t?.text?.html).find((h) => typeof h === "string");
  return {
    title: kind === "gene" && symbol ? `${symbol} gene (${name})` : name,
    sourceName: "MedlinePlus Genetics",
    resourceType: kind,
    subject: symbol ?? name,
    summary: firstParagraph(html),
    url,
    lastUpdated: str(d?.published),
  };
}

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const looksLikeGene = (q: string) => /^[A-Za-z][A-Za-z0-9]{1,9}$/.test(q) && /\d|^[A-Z0-9]+$/.test(q);

async function getJson(f: typeof fetch, url: string): Promise<any | null> {
  try {
    const r = await f(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function lookupPatientEducation(
  query: string,
  { maxHealthTopics = 3, fetchImpl = fetch }: EducationLookupOptions = {},
): Promise<EducationResult[]> {
  const q = query.trim();
  if (!q) return [];

  const healthTopics = (async () => {
    try {
      const r = await fetchImpl(`${WS}?${new URLSearchParams({ db: "healthTopics", term: q, retmax: String(maxHealthTopics) })}`);
      return r.ok ? parseHealthTopicsXml(await r.text(), maxHealthTopics) : [];
    } catch {
      return [];
    }
  })();

  const genetics = (async () => {
    const s = slug(q);
    if (!s) return [];
    const found: EducationResult[] = [];
    if (looksLikeGene(q)) {
      const g = normalizeGenetics(await getJson(fetchImpl, `${GENETICS}/gene/${s}.json`), "gene");
      if (g) found.push(g);
    }
    const slugs = s.endsWith("-disease") ? [s] : [s, `${s}-disease`];
    for (const cs of slugs) {
      const c = normalizeGenetics(await getJson(fetchImpl, `${GENETICS}/condition/${cs}.json`), "condition");
      if (c) { found.push(c); break; }
    }
    return found;
  })();

  const all = [...(await genetics), ...(await healthTopics)];
  const seen = new Set<string>();
  return all.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
}
