import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchLiveResources } from "@/lib/resources-live.functions";
import type { Resource } from "@/data/resources";
import { Lock, Search } from "lucide-react";
import { pageHead } from "@/lib/seo";
import {
  CATEGORIES, COMING_SOON, RESOURCES, SEARCH_FIELDS, searchResources, type Category,
} from "@/data/resources";
import { EvidenceKey, ResourceCard } from "@/components/resources/ResourceCards";
import { AskRarelyAlone } from "@/components/resources/AskRarelyAlone";
import { ResearchResults, AtlasResearchResults } from "@/components/resources/ResearchSection";
import type { AtlasResearchMatch } from "@/lib/atlas-research";
import { getResearch } from "@/lib/research.functions";
import { useExperience } from "@/lib/experience";
import type { ResearchMatch } from "@/lib/rare-dataset.server";

export const Route = createFileRoute("/resources")({
  head: () => pageHead("Resources", "Trustworthy evidence on rare diseases, genes, studies, registries, and patient organizations."),
  component: Page,
});

const SECTION_INTRO: Record<Category, string> = {
  education: "Plain-language guides from trusted health sources.",
  research: "Recent PubMed articles and NIH-funded projects for the disease you search, from the Rarely Alone dataset.",
  trials: "Research studies looking for participants. Joining is a personal choice to discuss with your care team.",
  registries: "Databases that collect information to speed up research.",
  organizations: "Groups that offer support, information, and advocacy.",
  atlas: "",
};

function Page() {
  const [query, setQuery] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const { experience } = useExperience();
  // Audience decides which sections exist; Atlas-connected resources are not shown on this page.
  const visible: Category[] = experience === "research" ? ["research", "trials", "registries"] : ["education", "trials", "registries"];
  useEffect(() => { setCats((p) => p.filter((c) => visible.includes(c))); }, [experience]); // eslint-disable-line react-hooks/exhaustive-deps
  const runResearch = useServerFn(getResearch);
  const [research, setResearch] = useState<{ q: string; matches: ResearchMatch[]; atlas: AtlasResearchMatch | null; failed: boolean } | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || experience !== "research") { setResearch(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      runResearch({ data: { q } })
        .then((r) => { if (!cancelled) setResearch({ q, matches: r.matches, atlas: r.atlas, failed: false }); })
        .catch(() => { if (!cancelled) setResearch({ q, matches: [], atlas: null, failed: true }); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, experience, runResearch]);
  const runLive = useServerFn(searchLiveResources);
  const [live, setLive] = useState<{ q: string; recognizedAs: string | null; education: Resource[]; trials: Resource[]; failedSources: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setLive(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      runLive({ data: { q } })
        .then((r) => { if (!cancelled) setLive({ q, ...r }); })
        .catch(() => { if (!cancelled) setLive({ q, recognizedAs: null, education: [], trials: [], failedSources: ["Live search"] }); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, runLive]);
  const results = useMemo(() => {
    const effCats: Category[] = cats.includes("registries") ? [...cats, "organizations"] : cats;
    const demo = searchResources(RESOURCES, query, effCats);
    if (!live || live.q !== query.trim()) return demo;
    const pick = (c: "education" | "trials", items: Resource[]) =>
      cats.length && !cats.includes(c) ? [] : items;
    // Live API results are primary for these two sections; static cards there are not mixed in.
    const liveEdu = pick("education", live.education);
    const liveTrials = pick("trials", live.trials);
    // NORD / Orphanet are general fallbacks for any recognized rare disease; disease-specific entries list first.
    const regOk = !cats.length || cats.includes("registries");
    const general = live.recognizedAs && regOk ? RESOURCES.filter((r) => r.general) : [];
    const others = demo.filter((r) => r.category !== "education" && r.category !== "trials" && !r.general);
    const generalShown = [...new Set([...general, ...demo.filter((r) => r.general)])];
    return [...liveEdu, ...liveTrials, ...others, ...generalShown];
  }, [query, cats, live]);
  const toggle = (c: Category) => setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const order = visible;

  return (
    <div className="space-y-8">
      <header>
        <h1>Resources</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Trustworthy evidence connected to diseases, genes, mechanisms, studies, registries, and patient organizations.
        </p>
      </header>

      <AskRarelyAlone />

      <div className="space-y-4 rounded-lg border border-border bg-surface p-4 md:p-5">
        <div className="relative">
          <label htmlFor="res-search" className="sr-only">Search resources</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="res-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search by ${SEARCH_FIELDS.join(", ")}`}
            className="h-12 w-full rounded-full border border-border bg-background pl-12 pr-4 outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button type="button" aria-pressed={cats.length === 0} onClick={() => setCats([])}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${cats.length === 0 ? "bg-primary text-primary-foreground" : "bg-tint-light text-foreground"}`}>
            All
          </button>
          {CATEGORIES.filter((c) => visible.includes(c.id)).map((c) => (
            <button key={c.id} type="button" aria-pressed={cats.includes(c.id)} onClick={() => toggle(c.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${cats.includes(c.id) ? "bg-primary text-primary-foreground" : "bg-tint-light text-foreground"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <EvidenceKey />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading ? "Searching live sources…" : <>{results.filter((r) => visible.includes(r.category === "organizations" ? "registries" : r.category)).length} results{live?.education.length || live?.trials.length ? " · includes live MedlinePlus / ClinicalTrials.gov" : ""}</>}
          </p>
        </div>
        <div aria-live="polite" className="space-y-1 text-sm text-muted-foreground empty:hidden">
          {!loading && live?.q === query.trim() && live.recognizedAs && <p>Recognized as: <span className="font-bold text-foreground">{live.recognizedAs}</span></p>}
          {!loading && live?.q === query.trim() && live.failedSources.length > 0 && (
            <p>Couldn't reach {live.failedSources.join(", ")} right now. Showing results from the sources that responded.</p>
          )}
        </div>
      </div>

      {order.map((cat) => {
        if (cats.length && !cats.includes(cat)) return null;
        const items = results.filter((r) => r.category === cat || (cat === "registries" && r.category === "organizations"));
        const label = CATEGORIES.find((c) => c.id === cat)!.label;
        const searched = query.trim().length >= 2;
        const done = searched && !loading && live?.q === query.trim();
        const empty =
          cat === "education" ? (done ? "No patient education resources found for this search." : !searched ? "Search for a rare disease, gene, or symptom to find trusted patient education." : null)
          : cat === "trials" ? (done ? "No clinical studies found for this search." : !searched ? "Search for a rare disease, gene, or symptom to find live clinical studies." : null)
          : cat === "research" ? (!searched ? "Search for a rare disease to see recent PubMed articles and NIH-funded projects." : research?.q !== query.trim() ? "Searching research records…" : research.failed ? "Couldn't load research records right now." : "No research records for this search in the Rarely Alone dataset yet.")
          : "Verified registries and patient organizations will appear here when available for the selected disease.";
        const researchMatches = cat === "research" && research?.q === query.trim() ? research.matches : [];
        const atlasResearch = cat === "research" && research?.q === query.trim() ? research.atlas : null;
        if (cat === "research") {
          return (
            <section key={cat} aria-labelledby="sec-research">
              <h2 id="sec-research">{label}</h2>
              <p className="mt-1 text-muted-foreground">{SECTION_INTRO.research}</p>
              {researchMatches.length > 0 && <ResearchResults matches={researchMatches} />}
              {atlasResearch && <AtlasResearchResults match={atlasResearch} />}
              {!researchMatches.length && !atlasResearch && <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{empty}</p>}
            </section>
          );
        }
        const liveCat = (cat === "education" || cat === "trials") && done;
        const showEmpty = items.length === 0 || (!searched && cat === "education");
        return (
          <section key={cat} aria-labelledby={`sec-${cat}`}>
            <h2 id={`sec-${cat}`} className="flex items-center gap-2">
              {label}
              {items.length > 0 && <span className="text-base font-normal text-muted-foreground">· {items.length}</span>}
            </h2>
            <p className="mt-1 text-muted-foreground">{SECTION_INTRO[cat]}</p>
            {showEmpty && empty && !(liveCat && items.length) && (
              <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{loading && (cat === "education" || cat === "trials") ? "Searching live sources…" : empty}</p>
            )}
            {cat === "trials" && items.length > 0 ? (() => {
              // Open/recruiting registry records vs completed or stopped studies; preclinical work never appears here.
              const activeItems = items.filter((r) => r.category !== "trials" || r.active !== false);
              const pastItems = items.filter((r) => r.category === "trials" && r.active === false);
              return (
                <>
                  <h3 className="mt-4 text-lg">Active or recruiting trials</h3>
                  {activeItems.length ? (
                    <div className="mt-3 grid gap-4 md:grid-cols-2">{activeItems.map((r) => <ResourceCard key={r.id} r={r} />)}</div>
                  ) : (
                    <p className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No active recruiting trials found for this search. Related completed or curated studies are shown below when available.</p>
                  )}
                  {pastItems.length > 0 && (
                    <>
                      <h3 className="mt-6 text-lg">Completed or non-recruiting clinical studies</h3>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">{pastItems.map((r) => <ResourceCard key={r.id} r={r} />)}</div>
                    </>
                  )}
                </>
              );
            })() : items.length > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {items.map((r) => <ResourceCard key={r.id} r={r} />)}
              </div>
            )}
          </section>
        );
      })}

      <section aria-labelledby="sec-soon" className="rounded-lg border border-dashed border-border p-5 text-muted-foreground">
        <h2 id="sec-soon" className="flex items-center gap-2 text-xl">
          <Lock className="h-5 w-5" aria-hidden="true" /> {COMING_SOON.title}
          <span className="rounded-full bg-tint-warm px-2 py-0.5 text-xs font-bold text-foreground">Coming soon</span>
        </h2>
        <p className="mt-1 text-sm">{COMING_SOON.text}</p>
      </section>
    </div>
  );
}
