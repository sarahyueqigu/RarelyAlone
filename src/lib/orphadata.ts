// Reusable rare-disease normalization using the official Orphadata API (Orphanet, CC BY 4.0).
//   https://api.orphadata.com  (OpenAPI: https://api.orphadata.com/openapi.json)
// Endpoints used:
//   /rd-cross-referencing/orphacodes/names/{name}   name -> disorder (synonyms, external refs)
//   /rd-cross-referencing/orphacodes/{orphacode}     disorder by code
//   /rd-phenotypes/orphacodes/{orphacode}            HPO annotations
//   /rd-classification/orphacodes/{orphacode}/hchids parents / subtypes
//   /rd-associated-genes/orphacodes/{orphacode}      genes for a disorder (often only on subtypes)
//   /rd-associated-genes/genes                       gene symbol list (symbol -> gene name)
//   /rd-associated-genes/genes/names/{name}          disorders linked to a gene
// Never invents matches: returns null when nothing reliable is found.

const API = "https://api.orphadata.com";

export interface OrphaCrossReference {
  source: string;
  reference: string;
  /** Orphanet's mapping relation, e.g. "E (Exact mapping...)". */
  relation: string | null;
  validated: boolean;
}
export interface OrphaGene {
  symbol: string;
  name: string | null;
  associationType: string | null;
  /** ORPHAcode the association is recorded on (the disorder itself or one of its subtypes). */
  recordedOn: number;
}
export interface OrphaPhenotype {
  hpoId: string;
  term: string;
  frequency: string | null;
}
export interface OrphaDisease {
  orphaCode: number;
  preferredName: string;
  disorderGroup: string | null;
  synonyms: string[];
  genes: OrphaGene[];
  phenotypes: OrphaPhenotype[];
  crossReferences: OrphaCrossReference[];
  orphanetUrl: string;
  source: "Orphadata";
  /** How the query was resolved. */
  matchedBy: "name" | "gene";
}

export interface OrphaOptions {
  fetchImpl?: typeof fetch;
  /** Skip the extra phenotype/gene/classification calls. */
  basicOnly?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const arr = <T = any>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

async function getJson(path: string, f: typeof fetch): Promise<any | null> {
  try {
    const r = await f(`${API}${path}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j: any = await r.json();
    return j?.data?.results ?? null;
  } catch {
    return null;
  }
}

const STOP = new Set(["disease", "disorder", "syndrome", "type", "the", "of"]);
export const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !STOP.has(t));

/** True when every meaningful query token appears in the name or one synonym. Guards against fuzzy false hits. */
export function isReliableNameMatch(query: string, names: string[]): boolean {
  const q = tokens(query);
  if (!q.length) return false;
  return names.some((n) => {
    const t = new Set(tokens(n));
    return q.every((x) => t.has(x));
  });
}

export const looksLikeGeneSymbol = (q: string) => /^[A-Z][A-Z0-9-]{1,9}$/.test(q.trim()) && /\d|^[A-Z]{3,}$/.test(q.trim());

export function normalizeCrossRef(raw: any): OrphaCrossReference[] {
  return arr(raw?.ExternalReference)
    .map((x: any) => ({
      source: str(x?.Source) ?? "",
      reference: str(String(x?.Reference ?? "")) ?? "",
      relation: str(x?.DisorderMappingRelation),
      validated: x?.DisorderMappingValidationStatus === "Validated",
    }))
    .filter((x) => x.source && x.reference);
}

export function normalizePhenotypes(raw: any): OrphaPhenotype[] {
  return arr(raw?.Disorder?.HPODisorderAssociation)
    .map((a: any) => ({ hpoId: str(a?.HPO?.HPOId) ?? "", term: str(a?.HPO?.HPOTerm) ?? "", frequency: str(a?.HPOFrequency) }))
    .filter((p) => p.hpoId && p.term);
}

export function normalizeGenes(raw: any, recordedOn: number): OrphaGene[] {
  const list = Array.isArray(raw) ? raw : [raw];
  return list.flatMap((r: any) =>
    arr(r?.DisorderGeneAssociation).map((a: any) => ({
      symbol: str(a?.Gene?.Symbol) ?? "",
      name: str(a?.Gene?.name),
      associationType: str(a?.DisorderGeneAssociationType),
      recordedOn,
    })),
  ).filter((g) => g.symbol);
}

function baseFromCrossRef(r: any, matchedBy: OrphaDisease["matchedBy"]): OrphaDisease | null {
  const code = Number(r?.ORPHAcode);
  const name = str(r?.["Preferred term"]);
  if (!Number.isInteger(code) || code <= 0 || !name || name.startsWith("OBSOLETE")) return null;
  return {
    orphaCode: code,
    preferredName: name,
    disorderGroup: str(r?.DisorderGroup),
    synonyms: arr<string>(r?.Synonym).map(str).filter((s): s is string => !!s),
    genes: [],
    phenotypes: [],
    crossReferences: normalizeCrossRef(r),
    orphanetUrl: `https://www.orpha.net/en/disease/detail/${code}`,
    source: "Orphadata",
    matchedBy,
  };
}

async function classification(code: number, f: typeof fetch): Promise<{ parents: number[]; childs: number[] }> {
  const r = arr(await getJson(`/rd-classification/orphacodes/${code}/hchids`, f));
  const parents = new Set<number>(), childs = new Set<number>();
  for (const h of r) {
    arr<number>(h?.parents).forEach((p) => parents.add(Number(p)));
    arr<number>(h?.childs).forEach((c) => childs.add(Number(c)));
  }
  return { parents: [...parents], childs: [...childs] };
}

async function enrich(d: OrphaDisease, f: typeof fetch): Promise<OrphaDisease> {
  const [ph, own, cls] = await Promise.all([
    getJson(`/rd-phenotypes/orphacodes/${d.orphaCode}`, f),
    getJson(`/rd-associated-genes/orphacodes/${d.orphaCode}`, f),
    classification(d.orphaCode, f),
  ]);
  let genes = own ? normalizeGenes(own, d.orphaCode) : [];
  if (!genes.length && cls.childs.length) {
    // Orphanet often records the gene on subtypes only; gather from direct subtypes.
    const sub = await Promise.all(cls.childs.slice(0, 12).map(async (c) => {
      const g = await getJson(`/rd-associated-genes/orphacodes/${c}`, f);
      return g ? normalizeGenes(g, c) : [];
    }));
    genes = sub.flat();
  }
  const seen = new Set<string>();
  d.genes = genes.filter((g) => (seen.has(g.symbol) ? false : (seen.add(g.symbol), true)));
  d.phenotypes = normalizePhenotypes(ph);
  return d;
}

async function byCode(code: number, f: typeof fetch, by: OrphaDisease["matchedBy"]) {
  return baseFromCrossRef(await getJson(`/rd-cross-referencing/orphacodes/${code}?lang=en`, f), by);
}

let geneListCache: { symbol: string; name: string }[] | null = null;
async function geneNameFor(symbol: string, f: typeof fetch): Promise<string | null> {
  if (!geneListCache) {
    const r = await getJson(`/rd-associated-genes/genes`, f);
    if (!r) return null;
    geneListCache = arr(r).map((g: any) => ({ symbol: String(g?.symbol ?? ""), name: String(g?.name ?? "") }));
  }
  return geneListCache.find((g) => g.symbol.toUpperCase() === symbol.toUpperCase())?.name || null;
}

async function resolveGene(symbol: string, f: typeof fetch): Promise<OrphaDisease | null> {
  const name = await geneNameFor(symbol, f);
  if (!name) return null;
  const r = arr(await getJson(`/rd-associated-genes/genes/names/${encodeURIComponent(name)}`, f));
  const codes = r
    .filter((x: any) => arr(x?.DisorderGeneAssociation).some((a: any) => a?.Gene?.Symbol?.toUpperCase() === symbol.toUpperCase()))
    .map((x: any) => ({ code: Number(x?.ORPHAcode), group: str(x?.DisorderGroup) }))
    .filter((x) => Number.isInteger(x.code));
  if (!codes.length) return null;
  const disorders = codes.filter((c) => c.group === "Disorder");
  let pick: number | null = disorders.length === 1 ? disorders[0]!.code : null;
  if (pick === null && !disorders.length) {
    // All linked records are subtypes: use their parent only if they share exactly one.
    const ps = await Promise.all(codes.map((c) => classification(c.code, f).then((x) => x.parents)));
    const common = ps.reduce((a, b) => a.filter((x) => b.includes(x)));
    if (common.length === 1) pick = common[0]!;
  }
  if (pick === null) return null; // several unrelated disorders: no single reliable match
  return byCode(pick, f, "gene");
}

async function resolveName(q: string, f: typeof fetch): Promise<OrphaDisease | null> {
  const variants = [...new Set([q, q.replace(/-/g, " "), `${q} disease`])];
  for (const v of variants) {
    const d = baseFromCrossRef(await getJson(`/rd-cross-referencing/orphacodes/names/${encodeURIComponent(v)}?lang=en`, f), "name");
    if (d && isReliableNameMatch(q, [d.preferredName, ...d.synonyms])) return d;
  }
  return null;
}

/** Most relevant Orphanet disorder for a disease name, synonym, or gene symbol — or null. */
export async function normalizeRareDisease(query: string, { fetchImpl = fetch, basicOnly = false }: OrphaOptions = {}): Promise<OrphaDisease | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  const d = looksLikeGeneSymbol(q) ? (await resolveGene(q, fetchImpl)) ?? null : await resolveName(q, fetchImpl);
  if (!d) return null;
  return basicOnly ? d : enrich(d, fetchImpl);
}
