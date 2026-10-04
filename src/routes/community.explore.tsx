import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, FlaskConical, Building2, BookOpen } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { getDiseaseList, getDiseaseProfile } from "@/lib/circle-explore.functions";
import type { DiseaseProfile, Trial, Project } from "@/lib/circle-explore.server";
import { ExternalA, btnSecondary, card } from "@/components/community/bits";

export const Route = createFileRoute("/community/explore")({
  validateSearch: (s: Record<string, unknown>): { d?: string } => (typeof s["d"] === "string" && s["d"] ? { d: s["d"] } : {}),
  head: () => pageHead("Find My Circle · Search all rare diseases", "Search every rare disease in the Rarely Alone dataset to see ongoing clinical trials, NIH-funded projects, and published literature."),
  loader: () => getDiseaseList(),
  component: Explore,
});

const statusLabel = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const money = (n: number | null) => (n == null ? null : `$${Math.round(n).toLocaleString("en-US")}`);

function Explore() {
  const list = Route.useLoaderData();
  const d = Route.useSearch().d ?? "";
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return list;
    return list.filter((x) => x.name.toLowerCase().includes(n) || x.synonyms.some((s) => s.toLowerCase().includes(n)));
  }, [q, list]);
  const fetchProfile = useServerFn(getDiseaseProfile);
  const profile = useQuery({ queryKey: ["circle-explore", d], queryFn: () => fetchProfile({ data: { name: d } }), enabled: !!d });

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-tint-warm p-6 md:p-8">
        <Link to="/community" className="text-sm text-primary underline">← Back to Find My Circle</Link>
        <h1 className="mt-2">Search all rare diseases.</h1>
        <p className="mt-2 max-w-2xl text-lg">Turn the network into action: clinical trials you could ask about, NIH-funded projects, and the published literature for this disease.</p>
        <p className="mt-2 text-sm text-muted-foreground">{list.length} diseases from the Rarely Alone dataset (ClinicalTrials.gov, NIH RePORTER, PubMed, OMIM, Orphanet). Nothing here is invented.</p>
      </section>

      <div className={card}>
        <label htmlFor="circle-search" className="font-bold">Find a disease</label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input id="circle-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a disease name or synonym, e.g. Noonan, NF1"
            className="h-12 w-full rounded-full border border-border bg-background pl-12 pr-4 outline-none focus:border-primary" />
        </div>
        <ul className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-auto" aria-label="Matching diseases">
          {matches.map((x) => (
            <li key={x.name}>
              <button type="button" aria-pressed={d === x.name} onClick={() => navigate({ search: { d: x.name } })}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${d === x.name ? "bg-primary text-primary-foreground" : "bg-tint-light text-foreground"}`}>
                {x.name}{x.ongoingTrials ? ` · ${x.ongoingTrials} ongoing trial${x.ongoingTrials > 1 ? "s" : ""}` : ""}
              </button>
            </li>
          ))}
          {!matches.length && <li className="text-sm text-muted-foreground">No disease in the dataset matches “{q}”.</li>}
        </ul>
      </div>

      {!d && <p className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">Choose a disease above to see what you can act on.</p>}
      {d && profile.isLoading && <p className="text-muted-foreground">Loading {d}…</p>}
      {d && profile.isError && <p className="text-muted-foreground">Couldn't load this disease right now. Please try again.</p>}
      {d && profile.data === null && <p className="text-muted-foreground">“{d}” isn't in the dataset.</p>}
      {profile.data && <ProfileView p={profile.data} />}
    </div>
  );
}

function Section({ id, icon, title, intro, children }: { id: string; icon: React.ReactNode; title: string; intro?: string | undefined; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="flex items-center gap-2">{icon}{title}</h2>
      {intro && <p className="text-muted-foreground">{intro}</p>}
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</p>;

function TrialCard({ t }: { t: Trial }) {
  return (
    <li className={card}>
      <p className="text-sm font-bold text-muted-foreground">{statusLabel(t.status)}{t.phases.length ? ` · ${t.phases.join(", ").replace(/PHASE/g, "Phase ")}` : ""}{t.studyType ? ` · ${statusLabel(t.studyType)}` : ""}</p>
      <p className="mt-1 font-bold">{t.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{[t.sponsor && `Sponsor: ${t.sponsor}`, t.enrollment != null && `${t.enrollment} participants`, t.completion && `Completion ${t.completion}`].filter(Boolean).join(" · ")}</p>
      <ExternalA href={t.url} className="mt-2 inline-block text-sm text-primary underline">ClinicalTrials.gov · {t.nctId}</ExternalA>
    </li>
  );
}
function ProjectCard({ p }: { p: Project }) {
  return (
    <li className={card}>
      <p className="text-sm font-bold text-muted-foreground">{p.focus ? "Focuses on this disease" : "Mentions this disease"} · {p.status} · FY {p.years.join(", ")}</p>
      <p className="mt-1 font-bold">{p.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{[p.pis.join(", "), p.organization, p.location, money(p.amount)].filter(Boolean).join(" · ")}</p>
      {p.url && <ExternalA href={p.url} className="mt-2 inline-block text-sm text-primary underline">NIH RePORTER · {p.id}</ExternalA>}
    </li>
  );
}

function ProfileView({ p }: { p: DiseaseProfile }) {
  const [showPast, setShowPast] = useState(false);
  const links = [["NORD", p.links.nord], ["Orphanet", p.links.orphanet], ["GARD", p.links.gard], ["OMIM", p.links.omim]].filter(([, u]) => u) as [string, string][];
  return (
    <div className="space-y-10">
      <header className={card}>
        <h2 className="text-2xl">{p.name}</h2>
        {p.synonyms.length > 0 && <p className="mt-1 text-sm text-muted-foreground">Also known as {p.synonyms.join(", ")}</p>}
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-muted-foreground">Gene</dt><dd className="font-bold">{p.gene ? `${p.gene.symbol}${p.gene.location ? ` (${p.gene.location})` : ""}` : "None recorded"}</dd></div>
          <div><dt className="text-muted-foreground">Inheritance</dt><dd className="font-bold">{p.gene?.inheritance ?? "Not recorded"}</dd></div>
          <div><dt className="text-muted-foreground">Active trials</dt><dd className="font-bold">{p.activeCount}</dd></div>
          <div><dt className="text-muted-foreground">PubMed articles</dt><dd className="font-bold">{p.pubmed.count.toLocaleString("en-US")}</dd></div>
        </dl>
        {p.mechanism && <p className="mt-3 text-sm">Likely mechanism: <span className="font-bold">{p.mechanism}</span>{p.mechanismBasis ? ` — ${p.mechanismBasis}` : ""}</p>}
        {links.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{links.map(([l, u]) => <ExternalA key={l} href={u} className={btnSecondary}>{l}</ExternalA>)}</div>}
      </header>


      <Section id="trials" icon={<FlaskConical className="h-5 w-5" aria-hidden="true" />} title="Clinical trials" intro="From ClinicalTrials.gov, grouped by status.">
        <h3 className="text-lg">Ongoing · {p.trials.ongoing.length}</h3>
        {p.trials.ongoing.length ? <ul className="grid gap-4 md:grid-cols-2">{p.trials.ongoing.map((t) => <TrialCard key={t.nctId} t={t} />)}</ul> : <Empty>No ongoing trials for this disease. Completed studies are listed below when available.</Empty>}
        {(p.trials.completed.length > 0 || p.trials.stopped.length > 0) && (
          <details className="mt-4">
            <summary className="cursor-pointer font-bold">Completed ({p.trials.completed.length}) and stopped or unknown ({p.trials.stopped.length})</summary>
            <ul className="mt-3 grid gap-4 md:grid-cols-2">{[...p.trials.completed, ...p.trials.stopped].map((t) => <TrialCard key={t.nctId} t={t} />)}</ul>
          </details>
        )}
      </Section>

      <Section id="projects" icon={<Building2 className="h-5 w-5" aria-hidden="true" />} title="NIH-funded research projects" intro={p.projects.ongoingAmount ? `Ongoing funding: ${money(p.projects.ongoingAmount)}.` : undefined}>
        <h3 className="text-lg">Ongoing · {p.projects.ongoing.length}</h3>
        {p.projects.ongoing.length ? <ul className="grid gap-4 md:grid-cols-2">{p.projects.ongoing.map((x) => <ProjectCard key={x.id} p={x} />)}</ul> : <Empty>No ongoing NIH-funded projects for this disease.</Empty>}
        {p.projects.past.length > 0 && (
          <>
            <button type="button" className={`${btnSecondary} mt-3`} onClick={() => setShowPast((v) => !v)}>{showPast ? "Hide" : "Show"} {p.projects.past.length} past projects</button>
            {showPast && <ul className="mt-3 grid gap-4 md:grid-cols-2">{p.projects.past.map((x) => <ProjectCard key={x.id} p={x} />)}</ul>}
          </>
        )}
      </Section>

      <Section id="literature" icon={<BookOpen className="h-5 w-5" aria-hidden="true" />} title="Literature" intro={p.pubmed.count ? `${p.pubmed.count.toLocaleString("en-US")} PubMed articles (${p.pubmed.reviews} reviews), ${p.pubmed.first ?? "?"}–${p.pubmed.latest ?? "?"}.` : undefined}>
        {p.pubmed.articles.length ? (
          <ul className="space-y-2">{p.pubmed.articles.map((a) => <li key={a.pmid} className="text-sm"><ExternalA href={a.url} className="font-bold text-primary underline">{a.title}</ExternalA>{[a.journal, a.year].filter(Boolean).length ? ` · ${[a.journal, a.year].filter(Boolean).join(", ")}` : ""} · PMID {a.pmid}</li>)}</ul>
        ) : <Empty>No PubMed articles in the dataset for this disease.</Empty>}
        {p.pubmed.url && <ExternalA href={p.pubmed.url} className="text-sm text-primary underline">See all on PubMed</ExternalA>}
      </Section>
    </div>
  );
}
