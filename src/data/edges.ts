import type { DiseaseId } from "./diseases";

export type EdgeStrength = "same_pathway" | "same_neighborhood" | "candidate";

export interface Edge {
  id: string;
  from: DiseaseId;
  to: DiseaseId;
  strength: EdgeStrength;
  summary: string;
  evidenceType: string;
  sourceTitle: string;
  sourceUrl: string;
  caveat?: string;
  extra?: { summary: string; evidenceType: string; sourceTitle: string; sourceUrl: string };
  researchDetail?: { text: string; contradicted: string };
}

export const STRENGTH_LABELS: Record<EdgeStrength, string> = {
  same_pathway: "Same pathway",
  same_neighborhood: "Same cellular neighborhood",
  candidate: "Candidate connection, still being studied",
};

const LSD = { sourceTitle: "Not reported", sourceUrl: "" };
const NEIGHBORHOOD = "Both are lysosomal storage diseases, where substances build up in the cell's recycling center.";
const TRIAL = {
  summary: "One recruiting Phase 3 master protocol tests the same therapy across NPC, GM1, and GM2.",
  evidenceType: "Clinical trial",
  sourceTitle: "ClinicalTrials.gov NCT07054515",
  sourceUrl: "https://clinicaltrials.gov/study/NCT07054515",
};
const SPG_DETAIL = {
  text: "Reducing ganglioside synthesis with venglustat delayed symptoms in Spg11 knockout mice. Same drug class does not mean the same result.",
  contradicted: "A 2025 review reports miglustat was very poorly effective in Spg11 mice.",
};

export const EDGES: Edge[] = [
  {
    id: "tay-sandhoff",
    from: "tay-sachs",
    to: "sandhoff",
    strength: "same_pathway",
    summary:
      "Both involve GM2 buildup from missing hexosaminidase activity; in an infantile GM2 natural history study, Tay-Sachs and Sandhoff variants did not differ.",
    evidenceType: "Human",
    ...LSD,
  },
  { id: "tay-npc", from: "tay-sachs", to: "npc", strength: "same_neighborhood", summary: NEIGHBORHOOD, evidenceType: "Human", ...LSD, extra: TRIAL },
  { id: "sandhoff-npc", from: "sandhoff", to: "npc", strength: "same_neighborhood", summary: NEIGHBORHOOD, evidenceType: "Human", ...LSD, extra: TRIAL },
  { id: "tay-gaucher", from: "tay-sachs", to: "gaucher", strength: "same_neighborhood", summary: NEIGHBORHOOD, evidenceType: "Human", ...LSD },
  { id: "sandhoff-gaucher", from: "sandhoff", to: "gaucher", strength: "same_neighborhood", summary: NEIGHBORHOOD, evidenceType: "Human", ...LSD },
  { id: "npc-gaucher", from: "npc", to: "gaucher", strength: "same_neighborhood", summary: NEIGHBORHOOD, evidenceType: "Human", ...LSD },
  {
    id: "spg11-tay",
    from: "spg11",
    to: "tay-sachs",
    strength: "candidate",
    summary:
      "In research models, loss of SPG11 causes lysosomal buildup of gangliosides including GM2, the same lipid that builds up in Tay-Sachs and Sandhoff.",
    evidenceType: "Animal and cell models",
    sourceTitle: "Spatacsin and gangliosides (DOAJ)",
    sourceUrl: "https://doaj.org/article/358623cb25c54ed8bb5c4530b6f112e8",
    caveat: "Seen in research models, not yet in patients. A lead to investigate, not a conclusion.",
    researchDetail: SPG_DETAIL,
  },
  {
    id: "spg11-sandhoff",
    from: "spg11",
    to: "sandhoff",
    strength: "candidate",
    summary:
      "In research models, loss of SPG11 causes lysosomal buildup of gangliosides including GM2, the same lipid that builds up in Tay-Sachs and Sandhoff.",
    evidenceType: "Animal and cell models",
    sourceTitle: "Spatacsin and gangliosides (DOAJ)",
    sourceUrl: "https://doaj.org/article/358623cb25c54ed8bb5c4530b6f112e8",
    caveat: "Seen in research models, not yet in patients. A lead to investigate, not a conclusion.",
    researchDetail: SPG_DETAIL,
  },
  {
    id: "spg11-npc",
    from: "spg11",
    to: "npc",
    strength: "candidate",
    summary: "In research models, cholesterol builds up in lysosomes when SPG11 is lost, a feature central to NPC.",
    evidenceType: "Animal and cell models",
    sourceTitle: "SPG11 research (DOAJ)",
    sourceUrl: "https://doaj.org/article/dbf32e1bf6a942ce85d9572665e8edf3",
    caveat: "Seen in research models, not yet in patients.",
    researchDetail: SPG_DETAIL,
  },
];

export function edgeBetween(a: string, b: string): Edge | undefined {
  return EDGES.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
}
