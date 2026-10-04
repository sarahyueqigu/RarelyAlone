// Communities, researchers and organizations for the five-disease cluster come from src/data/diseases.ts
// (real, public information). Inquiries, shared experiences, patterns and shared-challenge circles are fictional.
import { CLUSTER_RESEARCHERS, DISEASES, STUDIES, diseaseById, isDiseaseId, LAST_VERIFIED, type DiseaseId } from "./diseases";
import { edgeBetween, type Edge } from "./edges";

export type FictionalConditionId = "kavr2" | "navl5" | "trpk1" | "zedl9";
export type ConditionId = DiseaseId | "undiagnosed" | FictionalConditionId;
export type ConnectionType = "exact" | "related_biology" | "shared_challenge" | "undiagnosed";
export type Platform = "Website" | "Facebook group" | "WhatsApp" | "Forum" | "Newsletter" | "Instagram";
export type Language = "English" | "Spanish" | "French" | "Portuguese";
export type Region = "Global" | "North America" | "Europe" | "Latin America";
export type Audience = "Patients" | "Caregivers" | "Both";
export type WhyTag = string;
export type Challenge =
  | "Sleep"
  | "Feeding"
  | "Seizures"
  | "School and daily life"
  | "Feeling alone"
  | "Understanding research"
  | "Still searching for a diagnosis";

export const CHALLENGES: Challenge[] = [
  "Sleep",
  "Feeding",
  "Seizures",
  "School and daily life",
  "Feeling alone",
  "Understanding research",
  "Still searching for a diagnosis",
];

export type Source =
  | "PubMed"
  | "NIH RePORTER"
  | "ClinicalTrials.gov"
  | "bioRxiv"
  | "medRxiv"
  | "Organization website"
  | "Public article by the founder (Genetic Alliance UK, 2025)"
  | "Public sources";

export const NOT_REPORTED = "Not reported" as const;

export interface Condition {
  id: ConditionId;
  label: string;
  short: string;
  group: "cluster" | "fictional";
}

export interface Community {
  id: string;
  name: string;
  runBy: string;
  connectionType: ConnectionType;
  /** Conditions this community is an exact match for. */
  exactFor: ConditionId[];
  purpose: string;
  conditions: string[];
  platforms: Platform[];
  languages: Language[] | typeof NOT_REPORTED;
  region: Region | typeof NOT_REPORTED;
  audience: Audience;
  whyThisAppears: string;
  evidenceLink?: string;
  officialUrl: string;
  source: Source;
  checkedDate: string;
  sharedChallenge?: string;
  challengeTags: Challenge[];
  isReal?: boolean;
  realNote?: string;
  /** Present on related-biology cards: the edge between the selected disease and this community's disease. */
  edge?: Edge;
  /** "closest" = not disease-specific but the nearest option (SPG11). */
  closest?: boolean;
  diseaseId?: DiseaseId;
}

export interface WorkItem {
  title: string;
  type: "paper" | "grant" | "study" | "preprint";
  year: number;
  source: Source;
  date?: string;
}

export interface Researcher {
  id: string;
  name: string;
  role: string;
  institution: string;
  profileUrl: string;
  profileLabel?: string;
  isBridge: boolean;
  whyTags: WhyTag[];
  whyThisAppears: string;
  recentWork: WorkItem[];
  diseases: ConditionId[];
  evidenceLink: string;
  verifyAffiliation?: boolean;
  isReal?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  type: "Patient organization" | "Registry" | "Consortium" | "Study team";
  maintains: string;
  conditions: string[];
  contactRoute: string;
  profileUrl: string;
  source: Source;
  checkedDate: string;
  whyThisAppears: string;
  diseases: ConditionId[];
  isReal?: boolean;
}

export interface Inquiry {
  id: string;
  fromName: string;
  condition: string;
  question: string;
  note: string;
  recipientId: string;
  recipientName: string;
  receivedDate: string;
  whyItReachedYou: string;
  status: "new" | "handled";
}

export interface FeedItem {
  id: string;
  title: string;
  author: string;
  source: Source;
  date: string;
  whyRelevant: string;
}

export const EVIDENCE_LINK = "/dashboard";

export const CONDITIONS: Condition[] = [
  ...DISEASES.map((d) => ({ id: d.id, label: d.name, short: d.id === "npc" ? "NPC" : d.name.replace(" disease", ""), group: "cluster" as const })),
  { id: "undiagnosed", label: "Still searching for a diagnosis", short: "Undiagnosed", group: "cluster" },
  { id: "kavr2", label: "KAVR2-related developmental epilepsy", short: "KAVR2", group: "fictional" },
  { id: "navl5", label: "NAVL5-related epilepsy", short: "NAVL5", group: "fictional" },
  { id: "trpk1", label: "TRPK1 condition", short: "TRPK1", group: "fictional" },
  { id: "zedl9", label: "ZEDL9 condition", short: "ZEDL9", group: "fictional" },
];
export const DEFAULT_CONDITION: ConditionId = "tay-sachs";
export const conditionLabel = (id: ConditionId) => CONDITIONS.find((c) => c.id === id)?.label ?? "Tay-Sachs disease";

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  exact: "Exact-disease community",
  related_biology: "Related biological community",
  shared_challenge: "Shared everyday challenges",
  undiagnosed: "Undiagnosed and multi-condition communities",
};

export const CONNECTION_EXPLAINERS: Record<ConnectionType, string> = {
  exact: "Same diagnosis.",
  related_biology:
    "A different condition that affects the same process in the body. Useful for research together.",

  shared_challenge:
    "Different conditions, similar daily struggles, like sleep or feeding. Useful for practical support.",
  undiagnosed:
    "For people still searching for answers or living with several conditions. Peer support and shared experiences.",
};

export const WHY_TAG_EXPLAINERS: Record<WhyTag, string> = {
  "Same mechanism": "Studies the same disrupted process in the body.",
  "Same or related disease": "Works on this condition or a closely related one.",
  "Same tool or model": "Uses the same lab model or assay.",
  "Complementary approach": "Brings a different method that could fill a gap.",
  "Runs a relevant study": "Leads a study that may be relevant.",
  "Maintains an asset": "Keeps a registry, dataset, or model others can use.",
};

export const communities: Community[] = [
  {
    id: "kavr2-families-foundation",
    challengeTags: ["Feeling alone"],
    name: "KAVR2 Families Foundation",
    runBy: "KAVR2 Families Foundation",
    connectionType: "exact",
    exactFor: ["kavr2"],
    purpose: "Support, family meetups, and a family-run registry.",
    conditions: ["KAVR2-related developmental epilepsy"],
    platforms: ["Website"],
    languages: ["English", "Spanish"],
    region: "Global",
    audience: "Both",
    whyThisAppears: "Run by the main patient organization for this exact diagnosis.",
    officialUrl: "https://example.org/kavr2-families",
    source: "Organization website",
    checkedDate: "Sep 12, 2026",
  },
  {
    id: "kavr2-parents-caregivers",
    challengeTags: ["Feeling alone", "School and daily life"],
    name: "KAVR2 Parents and Caregivers",
    runBy: "KAVR2 Families Foundation",
    connectionType: "exact",
    exactFor: ["kavr2"],
    purpose:
      "A private caregiver group, joined through the foundation's official page, for everyday questions and encouragement.",
    conditions: ["KAVR2-related developmental epilepsy"],
    platforms: ["Facebook group"],
    languages: ["English"],
    region: "Global",
    audience: "Caregivers",
    whyThisAppears: "Linked from the foundation's official website for caregivers of this exact diagnosis.",
    officialUrl: "https://example.org/kavr2-families/join",
    source: "Organization website",
    checkedDate: "Sep 12, 2026",
  },
  {
    id: "navl5-parents-network",
    challengeTags: ["Seizures", "Understanding research"],
    name: "NAVL5 Parents Network",
    runBy: "NAVL5 Parents Network",
    connectionType: "related_biology",
    exactFor: ["navl5"],
    purpose: "Family resources, webinars, and a monthly newsletter for NAVL5-related epilepsy.",
    conditions: ["NAVL5-related epilepsy"],
    platforms: ["Website", "Newsletter"],
    languages: ["English"],
    region: "North America",
    audience: "Both",
    whyThisAppears:
      "A different condition that affects the same body process as KAVR2, documented in 2 sources.",
    evidenceLink: EVIDENCE_LINK,
    officialUrl: "https://example.org/navl5-parents",
    source: "Organization website",
    checkedDate: "Aug 30, 2026",
  },
  {
    id: "channel-conditions-alliance",
    challengeTags: ["Understanding research", "Seizures"],
    name: "Channel Conditions Alliance",
    runBy: "A coalition of patient groups",
    connectionType: "related_biology",
    exactFor: [],
    purpose: "Brings families and groups across channel conditions together to share knowledge and data.",
    conditions: ["NAVL5-related epilepsy", "TRPK1 condition", "Other channel conditions"],
    platforms: ["Website"],
    languages: ["English", "French"],
    region: "Europe",
    audience: "Both",
    whyThisAppears:
      "Brings together several conditions that share the same disrupted mechanism; maintains a shared registry.",
    evidenceLink: EVIDENCE_LINK,
    officialUrl: "https://example.org/channel-alliance",
    source: "Organization website",
    checkedDate: "Sep 3, 2026",
  },
  {
    id: "nights-without-sleep",
    challengeTags: ["Sleep"],
    name: "Nights Without Sleep",
    runBy: "Rare Caregivers Collective",
    connectionType: "shared_challenge",
    exactFor: [],
    purpose: "A moderated forum for caregivers managing severe sleep disruption in rare conditions.",
    conditions: ["Nine rare conditions, including channel conditions"],
    platforms: ["Forum"],
    languages: ["English"],
    region: "Global",
    audience: "Caregivers",
    whyThisAppears: "Caregivers across 9 rare conditions managing severe sleep disruption.",
    officialUrl: "https://example.org/nights-without-sleep",
    source: "Organization website",
    checkedDate: "Sep 8, 2026",
    sharedChallenge: "Sleep",
  },
  {
    id: "steady-spoon-families",
    challengeTags: ["Feeding"],
    name: "Steady Spoon Families",
    runBy: "Steady Spoon Caregivers",
    connectionType: "shared_challenge",
    exactFor: [],
    purpose: "Practical feeding tips and peer support, joined through the organization's official form.",
    conditions: ["Rare conditions with feeding difficulties"],
    platforms: ["WhatsApp"],
    languages: ["Spanish", "Portuguese"],
    region: NOT_REPORTED,
    audience: "Caregivers",
    whyThisAppears: "Caregivers of children with rare conditions who share feeding challenges.",
    officialUrl: "https://example.org/steady-spoon/join",
    source: "Organization website",
    checkedDate: "Aug 22, 2026",
    sharedChallenge: "Feeding",
  },
];

communities.push({
  id: "that-patient-collective",
  name: "That Patient Collective",
  runBy: "An independent patient advocate (founded by patient advocate and author Tilly Rose)",
  connectionType: "undiagnosed",
  exactFor: [],
  purpose:
    "An Instagram community where patients with rare and undiagnosed conditions share their stories and support one another.",
  conditions: ["Rare and undiagnosed conditions"],
  platforms: ["Instagram"],
  languages: ["English"],
  region: NOT_REPORTED,
  audience: "Patients",
  whyThisAppears: "A community for people still searching for answers, with shared experiences from patients worldwide.",
  officialUrl: "https://www.instagram.com/thatpatientcollective",
  source: "Public article by the founder (Genetic Alliance UK, 2025)" as Source,
  checkedDate: "Oct 1, 2026",
  challengeTags: ["Still searching for a diagnosis", "Feeling alone"],
  isReal: true,
  realNote: "Listed from public sources. Please verify the account is active.",
});

export const researchers: Researcher[] = CLUSTER_RESEARCHERS.map((r) => ({
  id: r.id,
  name: r.name,
  role: "",
  institution: r.institution,
  profileUrl: r.profileUrl,
  profileLabel: r.profileLabel,
  isBridge: r.diseases.length > 1 || r.whyTags.some((t) => t.startsWith("Bridge")),
  whyTags: r.whyTags,
  whyThisAppears: r.focus,
  recentWork: [],
  diseases: r.diseases,
  evidenceLink: r.profileUrl,
  verifyAffiliation: r.verifyAffiliation ?? false,
  isReal: true,
}));

/** Unique organizations across the cluster, with the diseases each serves. */
export const organizations: Organization[] = (() => {
  const map = new Map<string, Organization>();
  for (const d of DISEASES)
    for (const c of d.communities) {
      const id = slug(c.name);
      const existing = map.get(id);
      if (existing) {
        existing.diseases.push(d.id);
        existing.conditions.push(d.name);
        continue;
      }
      map.set(id, {
        id,
        name: c.name,
        type: "Patient organization",
        maintains: c.description,
        conditions: [d.name],
        contactRoute: "Contact details on the organization's website",
        profileUrl: c.url,
        source: "Public sources",
        checkedDate: LAST_VERIFIED,
        whyThisAppears: c.connection === "closest" ? "Closest available option for SPG11." : `Serves the ${d.name} community.`,
        diseases: [d.id],
        isReal: true,
      });
    }
  return [...map.values()];
})();

export const seedInquiries: Inquiry[] = [
  {
    id: "inq-seed-1",
    fromName: "Sam T.",
    condition: "SPG11",
    question: "Ask whether families with SPG11 could ever join NPC research events",
    note: "",
    recipientId: "national-niemann-pick-disease-foundation-nnpdf",
    recipientName: "National Niemann-Pick Disease Foundation (NNPDF)",
    receivedDate: "Sep 24, 2026",
    whyItReachedYou: "Your community serves a disease with a candidate biological connection to SPG11.",
    status: "new",
  },
];

/** Real studies from the cluster list, shown in the research sidebar. */
export const newThisMonth: FeedItem[] = STUDIES.filter((s) => s.status === "Recruiting").map((s) => ({
  id: s.id,
  title: s.title,
  author: s.type,
  source: "ClinicalTrials.gov",
  date: s.status,
  whyRelevant: `Covers ${s.diseases.map((d) => diseaseById(d)?.name).join(", ")}.`,
}));

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function fromDisease(d: (typeof DISEASES)[number], c: (typeof DISEASES)[number]["communities"][number], type: ConnectionType, edge?: Edge): Community {
  return {
    id: slug(c.name),
    name: c.name,
    runBy: c.name,
    connectionType: type,
    exactFor: [d.id],
    purpose: c.description,
    conditions: [d.name],
    platforms: ["Website"],
    languages: NOT_REPORTED,
    region: (c.region as Region) ?? NOT_REPORTED,
    audience: "Both",
    whyThisAppears:
      type === "exact"
        ? c.connection === "closest"
          ? "Not SPG11-specific, but the closest community available."
          : `A patient organization for ${d.name}.`
        : edge?.summary ?? "",
    officialUrl: c.url,
    source: "Public sources",
    checkedDate: LAST_VERIFIED,
    challengeTags: ["Feeling alone", "Understanding research"],
    isReal: true,
    realNote: "Real, public information.",
    closest: c.connection === "closest",
    diseaseId: d.id,
    ...(edge ? { edge } : {}),
  };
}

/** Real cluster communities, deduplicated (used for lookups such as My circle). */
export const clusterCommunities: Community[] = (() => {
  const map = new Map<string, Community>();
  for (const d of DISEASES) for (const c of d.communities) if (!map.has(slug(c.name))) map.set(slug(c.name), fromDisease(d, c, "exact"));
  return [...map.values()];
})();
export const allCommunities = (): Community[] => [...communities, ...clusterCommunities];

export function communitiesFor(condition: ConditionId): Community[] {
  const shared = communities.filter((c) => c.connectionType === "shared_challenge" || c.connectionType === "undiagnosed");
  if (condition === "undiagnosed") return shared;
  if (isDiseaseId(condition)) {
    const d = diseaseById(condition)!;
    const exact = d.communities.map((c) => fromDisease(d, c, "exact"));
    const seen = new Set(exact.map((c) => c.id));
    const related: Community[] = [];
    for (const other of DISEASES) {
      if (other.id === d.id) continue;
      const edge = edgeBetween(d.id, other.id);
      if (!edge) continue;
      for (const c of other.communities) {
        const id = slug(c.name);
        if (seen.has(id)) continue;
        seen.add(id);
        related.push(fromDisease(other, c, "related_biology", edge));
      }
    }
    const rank = { same_pathway: 0, same_neighborhood: 1, candidate: 2 } as const;
    related.sort((a, b) => rank[a.edge!.strength] - rank[b.edge!.strength]);
    return [...exact, ...related, ...shared];
  }
  // Fictional examples keep their original behavior.
  return communities.filter((c) => {
    if (c.connectionType === "exact") return c.exactFor.includes(condition);
    if (c.connectionType === "related_biology") return !c.exactFor.includes(condition);
    return true;
  });
}

export function findRecipient(id: string): { id: string; name: string } | undefined {
  const r = researchers.find((x) => x.id === id) ?? organizations.find((x) => x.id === id);
  return r ? { id: r.id, name: r.name } : undefined;
}

/* ---------------- Shared experiences and patterns ---------------- */

export type Impact = "A little" | "A lot" | "Most days";
export type Visibility = "private" | "communities" | "researchers";
export const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: "private", label: "Keep private", desc: "Only you can see this." },
  { value: "communities", label: "Share with my communities", desc: "Visible to members of communities you've saved, without your full name." },
  { value: "researchers", label: "Share anonymously with researchers", desc: "Researchers only ever see combined patterns from many families, never you." },
];

export interface Symptom {
  code: string;
  label: string;
  area: string;
}
export const SYMPTOMS: Symptom[] = [
  { code: "HP:0000001", label: "Wakes many times a night", area: "Sleep" },
  { code: "HP:0000002", label: "Hard to fall asleep", area: "Sleep" },
  { code: "HP:0000003", label: "Trouble swallowing thin liquids", area: "Feeding and digestion" },
  { code: "HP:0000004", label: "Reflux or vomiting", area: "Feeding and digestion" },
  { code: "HP:0000005", label: "Seizures triggered by startle", area: "Seizures and movement" },
  { code: "HP:0000006", label: "Low muscle tone", area: "Seizures and movement" },
  { code: "HP:0000007", label: "Few or no spoken words", area: "Learning and communication" },
  { code: "HP:0000008", label: "Learning takes longer", area: "Learning and communication" },
  { code: "HP:0000009", label: "Big feelings or meltdowns", area: "Mood and behavior" },
  { code: "HP:0000010", label: "Anxiety in new places", area: "Mood and behavior" },
  { code: "HP:0000011", label: "Tires very quickly", area: "Energy and pain" },
  { code: "HP:0000012", label: "Pain that is hard to explain", area: "Energy and pain" },
];

export interface HelpedEntry {
  id: string;
  symptomCode: string;
  tried: string;
  changed: string;
  downsides: string;
  professional: "Yes" | "No" | "Prefer not to say";
}

export interface SharedExperience {
  role: "Patient" | "Caregiver";
  condition: string;
  symptoms: { code: string; impact?: Impact }[];
  other: string;
  helpedEntries: HelpedEntry[];
  visibility: { symptoms: Visibility; helped: Visibility };
  openToStudyContact: boolean;
  createdAt: string;
}

export const seedExperience: SharedExperience = {
  role: "Caregiver",
  condition: "KAVR2-related developmental epilepsy",
  symptoms: [
    { code: "HP:0000001", impact: "Most days" },
    { code: "HP:0000005", impact: "A lot" },
  ],
  other: "",
  helpedEntries: [
    {
      id: "h1",
      symptomCode: "HP:0000001",
      tried: "A consistent wind-down routine and blackout curtains",
      changed: "Fewer wake-ups on most nights; travel nights are still hard",
      downsides: "Hard to keep up when staying with family",
      professional: "Yes",
    },
  ],
  visibility: { symptoms: "researchers", helped: "communities" },
  openToStudyContact: false,
  createdAt: "Sep 20, 2026",
};

export type HelpedCategory = "Routines and environment" | "Therapies and equipment" | "School and daily-life supports" | "Other";

export interface Pattern {
  id: string;
  cluster: string;
  challenge: string;
  summary: string;
  role: "Caregivers" | "Patients";
  totalCount: number;
  countsByCondition: { condition: string; count: number }[];
  helpedReporters: number;
  helpedThemes: { theme: string; category: HelpedCategory; count: number }[];
  downsideNote?: string;
  coOccurring: { label: string; count: number }[];
  dateRange: string;
}

export const patterns: Pattern[] = [
  {
    id: "p-sleep",
    cluster: "Lysosomal cluster",
    challenge: "Severe sleep disruption",
    summary: "Reported by 42 caregivers across 3 conditions in this cluster.",
    role: "Caregivers",
    totalCount: 42,
    countsByCondition: [
      { condition: "Tay-Sachs", count: 19 },
      { condition: "NPC", count: 13 },
      { condition: "SPG11", count: 10 },
    ],
    helpedReporters: 15,
    helpedThemes: [
      { theme: "Consistent wind-down routines", category: "Routines and environment", count: 15 },
      { theme: "Blackout curtains", category: "Routines and environment", count: 12 },
      { theme: "White noise", category: "Routines and environment", count: 11 },
    ],
    downsideNote: "9 reported downsides when traveling.",
    coOccurring: [
      { label: "Startle-triggered seizures", count: 31 },
      { label: "Low muscle tone", count: 27 },
    ],
    dateRange: "Mar 2026 to Sep 2026",
  },
  {
    id: "p-feeding",
    cluster: "Lysosomal cluster",
    challenge: "Feeding difficulties",
    summary: "Reported by 34 caregivers across 3 conditions in this cluster.",
    role: "Caregivers",
    totalCount: 34,
    countsByCondition: [
      { condition: "Tay-Sachs", count: 14 },
      { condition: "NPC", count: 10 },
      { condition: "SPG11", count: 10 },
    ],
    helpedReporters: 18,
    helpedThemes: [
      { theme: "Feeding therapy sessions", category: "Therapies and equipment", count: 18 },
      { theme: "Adapted cups and seating", category: "Therapies and equipment", count: 13 },
      { theme: "Smaller, more frequent meals", category: "Routines and environment", count: 11 },
    ],
    coOccurring: [
      { label: "Low muscle tone", count: 24 },
      { label: "Reflux or vomiting", count: 17 },
    ],
    dateRange: "Feb 2026 to Sep 2026",
  },
  {
    id: "p-startle",
    cluster: "Lysosomal cluster",
    challenge: "Startle-triggered seizures",
    summary: "Reported by 38 caregivers across 2 conditions in this cluster.",
    role: "Caregivers",
    totalCount: 38,
    countsByCondition: [
      { condition: "Tay-Sachs", count: 23 },
      { condition: "NPC", count: 15 },
    ],
    helpedReporters: 12,
    helpedThemes: [
      { theme: "Quieter, predictable environments", category: "Routines and environment", count: 12 },
      { theme: "Warning cues before loud events", category: "Routines and environment", count: 10 },
    ],
    coOccurring: [
      { label: "Severe sleep disruption", count: 31 },
      { label: "Anxiety in new places", count: 16 },
    ],
    dateRange: "Jan 2026 to Sep 2026",
  },
  {
    id: "p-school",
    cluster: "Lysosomal cluster",
    challenge: "School and communication challenges",
    summary: "Reported by 29 caregivers across 3 conditions in this cluster.",
    role: "Caregivers",
    totalCount: 29,
    countsByCondition: [
      { condition: "Tay-Sachs", count: 11 },
      { condition: "NPC", count: 8 },
      { condition: "SPG11", count: 10 },
    ],
    helpedReporters: 16,
    helpedThemes: [
      { theme: "Picture-based communication boards", category: "School and daily-life supports", count: 16 },
      { theme: "Individual learning plans", category: "School and daily-life supports", count: 14 },
    ],
    coOccurring: [
      { label: "Few or no spoken words", count: 22 },
      { label: "Big feelings or meltdowns", count: 13 },
    ],
    dateRange: "Apr 2026 to Sep 2026",
  },
];
