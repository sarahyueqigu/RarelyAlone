// Derived, read-only view of Find My Circle connections.
// Everything here is computed from existing sourced data (diseases.ts, edges.ts, community.ts)
// and the Atlas science files. Nothing new is asserted.
import { ATLAS_ID, CLUSTER_RESEARCHERS, DISEASES, LAST_VERIFIED, STUDIES, diseaseById, type DiseaseId } from "./diseases";
import { EDGES, type Edge } from "./edges";
import { organizations, communities, type Organization } from "./community";
import { compare, nodeMap, pairs, sourceMap } from "@/lib/atlas/graph";
import { caveats, hypotheses, patientExplanation } from "@/lib/atlas/hypotheses";
import { getSharedResearchAssets } from "@/lib/atlas/resources";

export const SOURCE_CHECKED = LAST_VERIFIED;

export interface SourceLink { title: string; url: string }

export type OrgRelation = "same_diagnosis" | "broader_support";
export interface OrgForDisease { org: Organization; relation: OrgRelation; otherDiseases: string[] }

/** Organizations that support a disease. One entry per organization, even if it supports several diseases. */
export function organizationsFor(d: DiseaseId): OrgForDisease[] {
  const disease = diseaseById(d)!;
  return organizations
    .filter((o) => o.diseases.includes(d))
    .map((o) => {
      const entry = disease.communities.find((c) => c.url === o.profileUrl);
      return {
        org: o,
        relation: entry?.connection === "closest" ? "broader_support" : "same_diagnosis",
        otherDiseases: o.diseases.filter((x) => x !== d),
      } satisfies OrgForDisease;
    });
}

export function atlasPairFor(a: DiseaseId, b: DiseaseId) {
  const x = ATLAS_ID[a], y = ATLAS_ID[b];
  return pairs.find((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x));
}

const src = (id: string): SourceLink | null => {
  const s = sourceMap[id];
  return s?.url ? { title: s.title, url: s.url } : null;
};

export type ConnectionKind = "specific" | "category";
export interface BiologyConnection {
  other: DiseaseId;
  edge: Edge;
  kind: ConnectionKind;
  /** Specific shared mechanism / relationship (null for broad category overlap). */
  mechanism: string | null;
  status: "Documented" | "Inferred from research models" | "Broad category only";
  sources: SourceLink[];
  differences: string;
  notEstablished: string;
  atlasPairId?: string;
  /** Organizations supporting the other disease; flags ones that also support the selected disease. */
  orgs: { org: Organization; alsoSupportsSelected: boolean }[];
}

export function biologyConnections(d: DiseaseId): BiologyConnection[] {
  const self = diseaseById(d)!;
  const out: BiologyConnection[] = [];
  for (const e of EDGES) {
    if (e.from !== d && e.to !== d) continue;
    const other = e.from === d ? e.to : e.from;
    const o = diseaseById(other)!;
    const pair = atlasPairFor(d, other);
    const orgs = organizations
      .filter((x) => x.diseases.includes(other))
      .map((x) => ({ org: x, alsoSupportsSelected: x.diseases.includes(d) }));
    const genes = `Different genes (${self.genes.join(", ")} vs ${o.genes.join(", ")}); each disease has its own course and care.`;
    if (pair) {
      const c = compare(pair.a, pair.b);
      const mech = c.shared.find((f) => nodeMap[f.id]?.dimension === "mechanism");
      const expl = patientExplanation(pair.id);
      const cv = (caveats[pair.id as keyof typeof caveats] ?? [])[0];
      out.push({
        other, edge: e, kind: "specific",
        mechanism: mech ? nodeMap[mech.id]!.label : null,
        status: pair.role === "Exploratory" ? "Inferred from research models" : "Documented",
        sources: expl.sources.map(src).filter((s): s is SourceLink => !!s),
        differences: cv ? `${cv.title}. ${cv.text}` : genes,
        notEstablished: expl.uncertain,
        atlasPairId: pair.id,
        orgs,
      });
    } else if (e.strength === "candidate") {
      out.push({
        other, edge: e, kind: "specific",
        mechanism: e.summary,
        status: "Inferred from research models",
        sources: e.sourceUrl ? [{ title: e.sourceTitle, url: e.sourceUrl }] : [],
        differences: genes,
        notEstablished: e.caveat ?? "A lead to investigate, not a conclusion.",
        orgs,
      });
    } else {
      out.push({
        other, edge: e, kind: "category",
        mechanism: null,
        status: "Broad category only",
        sources: [],
        differences: genes,
        notEstablished: "Both are lysosomal storage diseases. No specific shared mechanism or reusable asset is established in our sources.",
        orgs,
      });
    }
  }
  const rank = { Documented: 0, "Inferred from research models": 1, "Broad category only": 2 } as const;
  return out.sort((a, b) => rank[a.status] - rank[b.status]);
}

export const sharedChallengeCircles = () =>
  communities.filter((c) => c.connectionType === "shared_challenge" || c.connectionType === "undiagnosed");

export const researchersFor = (d: DiseaseId) => CLUSTER_RESEARCHERS.filter((r) => r.diseases.includes(d));
export const studiesFor = (d: DiseaseId) => STUDIES.filter((s) => s.diseases.includes(d));

export interface ResearchAction {
  pairId: string;
  pairLabel: string;
  asset: string;
  whyRelevant: string;
  reusable: string;
  limitation: string;
  sources: SourceLink[];
  collaborator: (typeof CLUSTER_RESEARCHERS)[number] | undefined;
  organization: Organization | undefined;
}

/** One existing, sourced asset the selected disease could work on with a connected disease. */
export function researchActionFor(d: DiseaseId): ResearchAction | null {
  const conns = biologyConnections(d).filter((c) => c.atlasPairId);
  for (const c of conns) {
    const pair = pairs.find((p) => p.id === c.atlasPairId)!;
    const collaborator = researchersFor(d).find((r) => r.diseases.includes(c.other)) ?? researchersFor(d)[0];
    const organization = organizationsFor(d).find((o) => o.relation === "same_diagnosis")?.org ?? organizationsFor(d)[0]?.org;
    if (pair.role === "Exploratory") {
      const h = hypotheses()[0];
      if (!h) continue;
      return {
        pairId: pair.id, pairLabel: pair.label, asset: h.asset,
        whyRelevant: h.rationale, reusable: h.existing, limitation: h.missing,
        sources: h.sources.map(src).filter((s): s is SourceLink => !!s),
        collaborator, organization,
      };
    }
    const asset = getSharedResearchAssets(pair.id).find((x) => !/treatment|intervention/i.test(x.type));
    if (!asset) continue;
    const cv = (caveats[pair.id as keyof typeof caveats] ?? [])[0];
    return {
      pairId: pair.id, pairLabel: pair.label, asset: asset.label,
      whyRelevant: asset.whyRelevant, reusable: asset.description,
      limitation: cv ? `${cv.title}. ${cv.text}` : "Disease-specific validation is still needed.",
      sources: [...new Set([...asset.sourceIds, ...(cv?.sources ?? [])])].map(src).filter((s): s is SourceLink => !!s).slice(0, 4),
      collaborator, organization,
    };
  }
  return null;
}

export function inquiryDraft(d: DiseaseId, a: ResearchAction): string {
  const name = diseaseById(d)!.name;
  const lines = [
    `Research inquiry (draft, not sent)`,
    a.collaborator ? `To: ${a.collaborator.name}, ${a.collaborator.institution}` : a.organization ? `To: ${a.organization.name}` : "To: [choose a recipient]",
    "",
    `I'm writing from the ${name} community about an existing research asset: ${a.asset}.`,
    `Why it seems relevant: ${a.whyRelevant}`,
    `What may be reusable: ${a.reusable}`,
    `What remains unresolved: ${a.limitation}`,
    "",
    `Question: Is this asset already being used for ${name}, and if not, what would be needed to check whether it applies?`,
    "",
    "Sources:",
    ...a.sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`),
  ];
  return lines.join("\n");
}

export const ALL_DISEASE_IDS = DISEASES.map((d) => d.id);
