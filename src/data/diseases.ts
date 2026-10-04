// Real, public information for the five-disease lysosomal cluster.
// Facts are taken verbatim from the Community brief; "Not reported" is used for anything missing.

export type DiseaseId = "tay-sachs" | "sandhoff" | "npc" | "gaucher" | "spg11";
export type TreatmentTone = "approved" | "trials" | "none";
export type IconKey = "eye" | "dashed-circles" | "droplet" | "crumpled" | "path";

export interface NamedAfter { name: string; year: string; description: string }
export interface Face { name: string; initials: string; role: string; story: string; link: string }
export interface DiseaseCommunity {
  name: string;
  description: string;
  region: string;
  platform: string;
  url: string;
  connection: "exact" | "closest";
}
export interface ClusterResearcher {
  id: string;
  name: string;
  institution: string;
  focus: string;
  whyTags: string[];
  profileUrl: string;
  profileLabel: string;
  diseases: DiseaseId[];
  verifyAffiliation?: boolean;
}
export interface Study {
  id: string;
  title: string;
  type: "Natural history study" | "Treatment trial" | "Master protocol";
  status: string;
  diseases: DiseaseId[];
  url: string;
  highlight?: string;
}
export interface Disease {
  id: DiseaseId;
  name: string;
  category: string;
  nickname: string;
  nicknameExplanation: string;
  namedAfter: NamedAfter[];
  namedAfterNote?: string;
  alsoKnownAs: string[];
  genes: string[];
  whatBuildsUp: string;
  plainSummary: string;
  awareness: { label: string; monthDay: string; endMonthDay?: string; description: string };
  treatmentStatus: { label: string; tone: TreatmentTone };
  faceOfCommunity: Face;
  honestGap?: string;
  extraStory?: string;
  hopefulUpdate?: string;
  treatmentHistory?: string;
  researchExtra?: string;
  eventsUrl: string;
  communities: DiseaseCommunity[];
  sources: { title: string; url: string }[];
  accent: string;
  tint: string;
  iconKey: IconKey;
  lastVerified: string;
}

export const LAST_VERIFIED = "October 3, 2026";

const NTSAD: DiseaseCommunity = {
  name: "National Tay-Sachs and Allied Diseases Association (NTSAD)",
  description:
    "Leads efforts toward treatments and a cure for Tay-Sachs, Canavan, GM1, and Sandhoff, and hosts an Annual Family Conference.",
  region: "US and global",
  platform: "Website",
  url: "https://ntsad.org",
  connection: "exact",
};
const CATS: DiseaseCommunity = {
  name: "CATS Foundation (Cure and Action for Tay-Sachs)",
  description: "Supports UK families affected by Tay-Sachs and Sandhoff with equipment, respite, and a support network.",
  region: "UK",
  platform: "Website",
  url: "https://www.cats-foundation.org",
  connection: "exact",
};

export const DISEASES: Disease[] = [
  {
    id: "tay-sachs",
    name: "Tay-Sachs disease",
    category: "GM2 gangliosidosis",
    nickname: "The cherry-red spot",
    nicknameExplanation: "Doctors first recognized it by a red spot visible at the back of the eye.",
    namedAfter: [
      { name: "Waren Tay", year: "1881", description: "British ophthalmologist who described the red spot on the retina." },
      { name: "Bernard Sachs", year: "1887", description: "American neurologist who described the cellular changes." },
    ],
    alsoKnownAs: [],
    genes: ["HEXA"],
    whatBuildsUp: "GM2 ganglioside in nerve cells because the Hex-A enzyme is missing.",
    plainSummary: "GM2 ganglioside builds up in nerve cells because the Hex-A enzyme is missing.",
    awareness: { label: "NTSAD Day of Hope", monthDay: "09", description: "A month of awareness and fundraising led by NTSAD." },
    treatmentStatus: { label: "Clinical trials active", tone: "trials" },
    faceOfCommunity: {
      name: "Emily Rapp Black",
      initials: "ER",
      role: "Author",
      story:
        "Her memoir The Still Point of the Turning World tells the story of her son Ronan, diagnosed with Tay-Sachs at nine months old. Ronan was born in 2010 and died in 2013.",
      link: "https://en.wikipedia.org/wiki/Emily_Rapp_Black",
    },
    extraStory: "The first Tay-Sachs community screening event took place in Bethesda, Maryland, in May 1971.",
    eventsUrl: "https://ntsad.org",
    communities: [NTSAD, CATS],
    sources: [
      { title: "Tay-Sachs disease (Wikipedia)", url: "https://en.wikipedia.org/wiki/Tay%E2%80%93Sachs_disease" },
      { title: "NTSAD", url: "https://ntsad.org" },
      { title: "Emily Rapp Black (Wikipedia)", url: "https://en.wikipedia.org/wiki/Emily_Rapp_Black" },
    ],
    accent: "#B23A33",
    tint: "#F8E2E0",
    iconKey: "eye",
    lastVerified: LAST_VERIFIED,
  },
  {
    id: "sandhoff",
    name: "Sandhoff disease",
    category: "GM2 gangliosidosis, type II",
    nickname: "Tay-Sachs' rarer twin",
    nicknameExplanation: "It looks very similar to Tay-Sachs, but two enzymes (HexA and HexB) are missing instead of one.",
    namedAfter: [
      { name: "Konrad Sandhoff", year: "1968", description: "German chemist given the most credit for its discovery." },
    ],
    namedAfterNote: "First noticed in Germany in 1965 with Horst Jatzkewitz and Hartmut Pilz.",
    alsoKnownAs: ["Sandhoff-Jatzkewitz disease", "Total hexosaminidase deficiency"],
    genes: ["HEXB"],
    whatBuildsUp: "GM2 ganglioside in nerve cells because HexA and HexB are missing.",
    plainSummary: "GM2 ganglioside builds up in nerve cells because HexA and HexB are missing.",
    awareness: { label: "Sandhoff Awareness Month (NTSAD Day of Hope)", monthDay: "09", description: "September awareness alongside the NTSAD Day of Hope." },
    treatmentStatus: { label: "No treatment or cure yet", tone: "none" },
    faceOfCommunity: {
      name: "Kristin Merkel",
      initials: "KM",
      role: "Adult advocate living with late-onset Sandhoff",
      story:
        "After 23 years of dismissal and misdiagnosis, she was diagnosed with late-onset Sandhoff and now raises awareness and funds through NTSAD. She describes herself as one of only seven adults in the US living with the disease.",
      link: "https://ntsad.org/donate-campaigns/team-merkel-day-of-hope/",
    },
    eventsUrl: "https://ntsad.org",
    communities: [NTSAD, CATS],
    sources: [
      { title: "Sandhoff disease (Wikipedia)", url: "https://en.wikipedia.org/wiki/Sandhoff_disease" },
      { title: "NTSAD", url: "https://ntsad.org" },
    ],
    accent: "#6E4387",
    tint: "#EEE4F3",
    iconKey: "dashed-circles",
    lastVerified: LAST_VERIFIED,
  },
  {
    id: "npc",
    name: "Niemann-Pick disease type C",
    category: "NPC",
    nickname: "Childhood Alzheimer's",
    nicknameExplanation:
      "The NIH has called it this because of similarities between the brains of people with NPC and Alzheimer's disease.",
    namedAfter: [
      { name: "Albert Niemann", year: "1914", description: "German pediatrician who described the first patient." },
      { name: "Ludwig Pick", year: "1920s", description: "German pathologist who showed it was distinct from Gaucher disease." },
    ],
    alsoKnownAs: [],
    genes: ["NPC1", "NPC2"],
    whatBuildsUp: "Cholesterol and other lipids that cannot move properly inside cells.",
    plainSummary: "Cholesterol and other lipids cannot move properly inside cells.",
    awareness: { label: "Global Niemann-Pick Disease Awareness Day", monthDay: "10-19", description: "A global day of awareness for all Niemann-Pick types." },
    treatmentStatus: { label: "2 FDA-approved treatments (2024)", tone: "approved" },
    hopefulUpdate:
      "In September 2024, the FDA approved Miplyffa (arimoclomol, used with miglustat) and Aqneursa (levacetylleucine) for neurological symptoms of NPC in adults and children.",
    faceOfCommunity: {
      name: "The Parseghian family",
      initials: "AP",
      role: "Ara Parseghian Medical Research Foundation",
      story:
        "Named for legendary Notre Dame football coach Ara Parseghian, whose three youngest grandchildren were diagnosed with NPC in 1994. The family turned their loss into a foundation that has raised tens of millions of dollars for NPC research.",
      link: "https://news.nd.edu/news/parseghian/",
    },
    eventsUrl: "https://nnpdf.org",
    communities: [
      {
        name: "National Niemann-Pick Disease Foundation (NNPDF)",
        description: "Family network for all Niemann-Pick types with over 450 member families and an annual family conference.",
        region: "US",
        platform: "Website",
        url: "https://nnpdf.org",
        connection: "exact",
      },
      {
        name: "Ara Parseghian Medical Research Foundation",
        description: "Funds NPC research.",
        region: "US",
        platform: "Website",
        url: "https://parseghian.org",
        connection: "exact",
      },
    ],
    sources: [
      { title: "Niemann-Pick disease awareness (ASBMB Today)", url: "https://asbmb.org/asbmb-today/science/101923/niemann-pick-disease-awareness" },
      { title: "Parseghian (Notre Dame News)", url: "https://news.nd.edu/news/parseghian/" },
      { title: "FDA approves treatments for NPC (PharmTech)", url: "https://pharmtech.com/view/fda-approves-treatments-for-niemann-pick-disease-type-c" },
      { title: "NNPDF", url: "https://nnpdf.org" },
    ],
    accent: "#24705F",
    tint: "#DDF0EB",
    iconKey: "droplet",
    lastVerified: LAST_VERIFIED,
  },
  {
    id: "gaucher",
    name: "Gaucher disease",
    category: "Types 1, 2, and 3",
    nickname: "Crumpled tissue paper cells",
    nicknameExplanation: "Under the microscope, storage-filled Gaucher cells look like crumpled tissue paper.",
    namedAfter: [
      {
        name: "Philippe Gaucher",
        year: "1882",
        description:
          "French physician who described the first patient in his doctoral thesis while still a student, believing at the time it was a cancer of the spleen.",
      },
    ],
    alsoKnownAs: [],
    genes: ["GBA1"],
    whatBuildsUp: "Glucocerebroside, because the enzyme glucocerebrosidase is deficient.",
    plainSummary: "Glucocerebroside builds up because the enzyme glucocerebrosidase is deficient.",
    awareness: {
      label: "International Gaucher Day",
      monthDay: "10-01",
      description: "Originally July 26, Philippe Gaucher's birthday.",
    },
    treatmentStatus: { label: "Enzyme replacement therapy since the 1990s", tone: "approved" },
    treatmentHistory:
      "Enzyme replacement therapy became available in the US in the early 1990s. Types 2 and 3 involve the brain, where needs remain unmet.",
    researchExtra: "GBA1 variants are the most common known genetic risk factor for Parkinson's disease.",
    faceOfCommunity: {
      name: "Tanya Collin-Histed",
      initials: "TC",
      role: "CEO of the International Gaucher Alliance and a Gaucher parent",
      story:
        "Her advocacy began with her daughter's type 3 Gaucher diagnosis, and she has led the International Gaucher Alliance since 2008.",
      link: "https://www.gaucheralliance.org",
    },
    eventsUrl: "https://www.gaucheralliance.org",
    communities: [
      {
        name: "National Gaucher Foundation (NGF)",
        description: "Supports US patients through financial assistance, education, and patient services.",
        region: "US",
        platform: "Website",
        url: "https://www.gaucherdisease.org",
        connection: "exact",
      },
      {
        name: "International Gaucher Alliance (IGA)",
        description: "Patient-led global organization for the Gaucher community.",
        region: "Global",
        platform: "Website",
        url: "https://www.gaucheralliance.org",
        connection: "exact",
      },
    ],
    sources: [
      { title: "Philippe Gaucher (Wikipedia)", url: "https://en.wikipedia.org/wiki/Philippe_Gaucher" },
      { title: "International Gaucher Day (Gaucher Disease News)", url: "https://gaucherdiseasenews.com/2019/09/30/iga-uses-tattoos-rare-stars-mark-oct-1-international-gaucher-day" },
      { title: "National Gaucher Foundation", url: "https://www.gaucherdisease.org" },
    ],
    accent: "#96600F",
    tint: "#F7ECD8",
    iconKey: "crumpled",
    lastVerified: LAST_VERIFIED,
  },
  {
    id: "spg11",
    name: "SPG11",
    category: "Hereditary spastic paraplegia",
    nickname: "The hidden lysosomal link",
    nicknameExplanation:
      "Classified as a movement disorder, yet research models show its lysosomes accumulate lipids also seen in Tay-Sachs, Sandhoff, and NPC.",
    namedAfter: [],
    namedAfterNote: 'Not an eponym. "SPG" stands for spastic paraplegia gene, and 11 is its number.',
    alsoKnownAs: ["Nakamura-Osame syndrome", "Spastic paraplegia 11, autosomal recessive", "Protein: spatacsin"],
    genes: ["SPG11"],
    whatBuildsUp: "In research models: gangliosides including GM2 and GM3, and cholesterol, in lysosomes.",
    plainSummary:
      "The most common cause of recessive hereditary spastic paraplegia, with progressive leg stiffness and weakness and often cognitive changes.",
    awareness: { label: "HSP and PLS Awareness Week", monthDay: "08-23", endMonthDay: "08-28", description: "A week of awareness for hereditary spastic paraplegia and PLS." },
    treatmentStatus: { label: "No approved therapy", tone: "none" },
    honestGap:
      "We didn't find an SPG11-specific public advocate or patient organization yet. The voice below represents the broader HSP community.",
    faceOfCommunity: {
      name: "Jim Sheorn",
      initials: "JS",
      role: "HSP advocate with the Spastic Paraplegia Foundation",
      story: "Living with hereditary spastic paraplegia, he uses social media to connect people with HSP and raise awareness.",
      link: "https://sp-foundation.org",
    },
    eventsUrl: "https://sp-foundation.org",
    communities: [
      {
        name: "Spastic Paraplegia Foundation (SPF)",
        description: "All-volunteer organization dedicated to finding cures for HSP and PLS, with an annual conference.",
        region: "US",
        platform: "Website",
        url: "https://sp-foundation.org",
        connection: "closest",
      },
      {
        name: "AEPEF (Spanish Familial Spastic Paraparesis Association)",
        description: "Funds research grants focused specifically on SPG11.",
        region: "Spain",
        platform: "Website",
        url: "https://doaj.org/article/358623cb25c54ed8bb5c4530b6f112e8",
        connection: "closest",
      },
    ],
    sources: [
      { title: "Hereditary spastic paraplegia 11 (NORD)", url: "https://rarediseases.org/mondo-disease/hereditary-spastic-paraplegia-11/" },
      { title: "Spastic Paraplegia Foundation", url: "https://sp-foundation.org" },
      { title: "Spatacsin and gangliosides (DOAJ)", url: "https://doaj.org/article/358623cb25c54ed8bb5c4530b6f112e8" },
      { title: "SPG11 research (DOAJ)", url: "https://doaj.org/article/dbf32e1bf6a942ce85d9572665e8edf3" },
    ],
    accent: "#1F6FB2",
    tint: "#E1EEF9",
    iconKey: "path",
    lastVerified: LAST_VERIFIED,
  },
];

export const CLUSTER_RESEARCHERS: ClusterResearcher[] = [
  {
    id: "florian-eichler",
    name: "Florian Eichler, MD, PhD",
    institution: "Massachusetts General Hospital",
    focus: "Defines the pace of clinical decline in GM2 gangliosidosis to prepare for gene therapy trials.",
    whyTags: ["Natural history studies", "Bridge across Tay-Sachs and Sandhoff"],
    profileUrl: "https://www.massgeneral.org/neurology/research/eichler-lab",
    profileLabel: "View institutional profile",
    diseases: ["tay-sachs", "sandhoff"],
  },
  {
    id: "forbes-porter",
    name: "Forbes Porter, MD, PhD",
    institution: "NICHD (NIH)",
    focus: "Leads long-running NPC natural history studies and studied miglustat and swallowing outcomes in NPC1.",
    whyTags: ["Natural history studies", "Runs a relevant study"],
    profileUrl: "https://irp.nih.gov/pi/forbes-porter",
    profileLabel: "View institutional profile",
    diseases: ["npc"],
  },
  {
    id: "ellen-sidransky",
    name: "Ellen Sidransky, MD",
    institution: "NHGRI (NIH)",
    focus: "Studies Gaucher disease and its link to Parkinson's disease and develops small-molecule chaperones.",
    whyTags: ["Bridge to Parkinson's disease", "Complementary approach"],
    profileUrl: "https://www.genome.gov/staff/Ellen-Sidransky-MD",
    profileLabel: "View institutional profile",
    diseases: ["gaucher"],
  },
  {
    id: "frederic-darios",
    name: "Frédéric Darios, PhD",
    institution: "Not reported",
    focus: "Showed that spatacsin clears gangliosides from lysosomes and that reducing ganglioside synthesis helps SPG11 models.",
    whyTags: ["Same mechanism", "Bridge to GM2 biology"],
    profileUrl: "https://doaj.org/article/358623cb25c54ed8bb5c4530b6f112e8",
    profileLabel: "View publication",
    diseases: ["spg11", "tay-sachs", "sandhoff"],
    verifyAffiliation: true,
  },
  {
    id: "giovanni-stevanin",
    name: "Giovanni Stevanin, PhD",
    institution: "University of Bordeaux",
    focus: "SPG11 genetics and therapy research.",
    whyTags: ["Same or related disease"],
    profileUrl: "https://doaj.org/article/dbf32e1bf6a942ce85d9572665e8edf3",
    profileLabel: "View publication",
    diseases: ["spg11"],
    verifyAffiliation: true,
  },
];

export const STUDIES: Study[] = [
  { id: "nct02851862", title: "A Natural History of Late Onset Tay-Sachs Disease", type: "Natural history study", status: "Completed", diseases: ["tay-sachs"], url: "https://clinicaltrials.gov/study/NCT02851862" },
  { id: "nct04221451", title: "Venglustat in late-onset GM2 gangliosidosis (AMETHIST)", type: "Treatment trial", status: "Status varies by registry", diseases: ["tay-sachs", "sandhoff"], url: "https://clinicaltrials.gov/study/NCT04221451" },
  {
    id: "nct07054515",
    title: "Nizubaglustat Phase 3 master protocol in NPC, GM1, and GM2",
    type: "Master protocol",
    status: "Recruiting",
    diseases: ["npc", "tay-sachs", "sandhoff"],
    url: "https://clinicaltrials.gov/study/NCT07054515",
    highlight:
      "One therapy, several diseases: a recruiting Phase 3 master protocol testing nizubaglustat across NPC, GM1, and GM2 gangliosidosis (Tay-Sachs and Sandhoff).",
  },
  { id: "nct07399704", title: "PRISMA open-label nizubaglustat study in GM2 and NPC", type: "Treatment trial", status: "Recruiting", diseases: ["tay-sachs", "sandhoff", "npc"], url: "https://clinicaltrials.gov/study/NCT07399704" },
  { id: "nct00344331", title: "NIH NPC natural history study", type: "Natural history study", status: "Ongoing since 2006", diseases: ["npc"], url: "https://clinicaltrials.gov/study/NCT00344331" },
  { id: "nct05588167", title: "NPC genomic and phenotypic database", type: "Natural history study", status: "Recruiting", diseases: ["npc"], url: "https://clinicaltrials.gov/study/NCT05588167" },
];

export const diseaseById = (id: string) => DISEASES.find((d) => d.id === id);
export const isDiseaseId = (id: string): id is DiseaseId => DISEASES.some((d) => d.id === id);

/** Days until next occurrence of an awareness date (month-only dates use the 1st). */
export function nextOccurrence(d: Disease, today = new Date()): Date {
  const [m, day] = d.awareness.monthDay.split("-").map(Number) as [number, number | undefined];
  const y = today.getFullYear();
  const start = new Date(y, m - 1, day ?? 1);
  const end = d.awareness.endMonthDay
    ? new Date(y, Number(d.awareness.endMonthDay.split("-")[0]) - 1, Number(d.awareness.endMonthDay.split("-")[1]))
    : day
      ? start
      : new Date(y, m, 0); // whole month
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (end >= t) return start < t ? t : start;
  return new Date(y + 1, m - 1, day ?? 1);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function awarenessDateLabel(d: Disease): string {
  const [m, day] = d.awareness.monthDay.split("-").map(Number) as [number, number | undefined];
  if (!day) return `${MONTHS[m - 1]} (all month)`;
  if (d.awareness.endMonthDay) return `${MONTHS[m - 1]} ${day} to ${Number(d.awareness.endMonthDay.split("-")[1])}`;
  return `${MONTHS[m - 1]} ${day}`;
}

/** Stable bridge between the shared disease IDs and the Atlas science IDs. */
export type AtlasId = "tay" | "sand" | "npc" | "gaucher" | "spg";
export const ATLAS_ID: Record<DiseaseId, AtlasId> = { "tay-sachs": "tay", sandhoff: "sand", npc: "npc", gaucher: "gaucher", spg11: "spg" };
export const diseaseFromAtlasId = (a: string): DiseaseId | undefined =>
  (Object.keys(ATLAS_ID) as DiseaseId[]).find((k) => ATLAS_ID[k] === a);
