import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { useExperience } from "@/lib/experience";
import { useCommunity } from "@/lib/community-store";
import { newThisMonth, organizations, researchers, type Source, type WhyTag } from "@/data/community";
import { ChipToggle, ConditionSelector, ExternalA, FictionalTag, SourceChip, btnPrimary, btnSecondary, card } from "@/components/community/bits";
import { STUDIES, diseaseById, type Study } from "@/data/diseases";
import { DiseasePlate, PlateChip } from "@/components/community/DiseasePlate";
import { OrganizationCard, ResearcherCard } from "@/components/community/cards";
import { NetworkView } from "@/components/community/NetworkView";
import { PatternsPanel } from "@/components/community/Patterns";

const searchSchema = z.object({
  tab: z.enum(["researchers", "organizations", "inquiries", "patterns"]).optional(),
});

export const Route = createFileRoute("/community/research")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () =>
    pageHead("Research collaboration", "Researchers and organizations working on the same biology, tools, or related diseases."),
  component: ResearchPage,
});

const TAGS: WhyTag[] = [...new Set(researchers.flatMap((r) => r.whyTags))];
const SOURCES: Source[] = ["PubMed", "NIH RePORTER", "ClinicalTrials.gov", "bioRxiv", "medRxiv"];
type Recency = "any" | "year" | "3m";

function ResearchPage() {
  const { experience } = useExperience();
  const { inquiries, markHandled, highlightInquiryId, condition } = useCommunity();
  const disease = diseaseById(condition);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/community/research" });
  const isResearch = experience === "research";
  const tab = (search.tab === "inquiries" || search.tab === "patterns") && !isResearch ? "researchers" : (search.tab ?? "researchers");

  const [q, setQ] = useState("");
  const [tags, setTags] = useState<WhyTag[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [recency, setRecency] = useState<Recency>("any");
  const [bridgeOnly, setBridgeOnly] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(true);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    return researchers.filter((r) => {
      const hay = `${r.name} ${r.institution} ${r.whyThisAppears} ${r.diseases.join(" ")} ${r.recentWork.map((w) => w.title).join(" ")}`.toLowerCase();
      if (n && !hay.includes(n)) return false;
      if (tags.length && !tags.some((t) => r.whyTags.includes(t))) return false;
      if (sources.length && !r.recentWork.some((w) => sources.includes(w.source))) return false;
      if (recency !== "any" && r.recentWork.length === 0) return true;
      if (recency === "year" && !r.recentWork.some((w) => w.year >= 2026)) return false;
      if (recency === "3m" && !r.recentWork.some((w) => w.date && w.date >= "2026-07")) return false;
      if (bridgeOnly && !r.isBridge) return false;
      return true;
    });
  }, [q, tags, sources, recency, bridgeOnly]);

  const orgResults = organizations.filter((o) => {
    const n = q.trim().toLowerCase();
    return !n || `${o.name} ${o.maintains} ${o.conditions.join(" ")}`.toLowerCase().includes(n);
  });

  const clear = () => {
    setQ("");
    setTags([]);
    setSources([]);
    setRecency("any");
    setBridgeOnly(false);
  };

  const selectResearcher = (id: string) => {
    clear();
    navigate({ search: { tab: "researchers" } });
    setHighlight(id);
    setTimeout(() => {
      const el = document.getElementById(`researcher-${id}`);
      el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }, 50);
  };
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 2500);
    return () => clearTimeout(t);
  }, [highlight]);

  const newCount = inquiries.filter((i) => i.status === "new").length;
  const tabs = [
    { id: "researchers" as const, label: "Researchers" },
    { id: "organizations" as const, label: "Organizations and consortia" },
    ...(isResearch
      ? [
          { id: "inquiries" as const, label: "Inquiries" },
          { id: "patterns" as const, label: "Patterns" },
        ]
      : []),
  ];

  return (
    <div>
      <h1>Research collaboration</h1>
      {disease && (
        <div className="mt-4">
          <DiseasePlate d={disease} size="large" onChangeDisease={() => document.getElementById("research-condition")?.focus()} />
        </div>
      )}
      <p className="mt-2 text-lg text-muted-foreground">
        Researchers and organizations working on the same biology, tools, or related diseases.
      </p>
      <ConditionSelector id="research-condition" />
      <p className="mt-3 text-sm text-muted-foreground">
        Relevant expertise doesn't mean someone is available. We only show public professional information.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <label className="block">
          <span className="sr-only">Search by disease, gene, mechanism, or research tool</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by disease, gene, mechanism, or research tool"
            className="min-h-11 w-full rounded-md border border-border px-3"
          />
        </label>
        <details className="group mt-4 md:open:block" open>
          <summary className="cursor-pointer text-sm font-bold text-primary md:hidden">Filters</summary>
          <div className="mt-3 space-y-4">
            <ChipToggle label="Why this appears" options={TAGS} value={tags} onChange={setTags} />
            <ChipToggle label="Source" options={SOURCES} value={sources} onChange={setSources} />
            <div className="flex flex-wrap items-end gap-6">
              <label className="text-sm font-bold">
                Recency
                <select
                  value={recency}
                  onChange={(e) => setRecency(e.target.value as Recency)}
                  className="mt-1 block min-h-11 rounded-md border border-border bg-surface px-3 text-base font-normal"
                >
                  <option value="any">Any time</option>
                  <option value="year">Past year</option>
                  <option value="3m">Past 3 months</option>
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={bridgeOnly}
                  onClick={() => setBridgeOnly((b) => !b)}
                  className={`relative h-7 w-12 rounded-full transition-colors motion-reduce:transition-none ${bridgeOnly ? "bg-primary" : "bg-border"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-surface transition-all motion-reduce:transition-none ${bridgeOnly ? "left-6" : "left-1"}`} />
                </button>
                Bridge researchers only
              </label>
            </div>
          </div>
        </details>
        <div className="mt-4 flex items-center justify-between">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Showing {results.length} researchers, {orgResults.length} organizations
          </p>
          <button type="button" onClick={clear} className="text-sm text-primary underline">
            Clear filters
          </button>
        </div>
      </div>

      <section className={`${card} mt-6`}>
        <button
          type="button"
          className="flex w-full items-center justify-between"
          aria-expanded={mapOpen}
          onClick={() => setMapOpen((o) => !o)}
        >
          <h2 className="text-[22px]">Who works on this cluster</h2>
          <ChevronDown className={`h-5 w-5 text-primary ${mapOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {mapOpen && <div className="mt-4"><NetworkView onSelect={selectResearcher} /></div>}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <div role="tablist" aria-label="Result type" className="flex flex-wrap gap-2 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => navigate({ search: { tab: t.id } })}
                className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-4 px-3 ${
                  tab === t.id ? "border-primary font-bold text-primary" : "border-transparent text-foreground"
                }`}
              >
                {t.label}
                {t.id === "inquiries" && (
                  <span className="rounded-full bg-accent px-2 text-sm text-accent-foreground">{newCount}</span>
                )}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
            {tab === "researchers" && (
              <div className="space-y-8">
                <StudiesGroup diseaseId={disease?.id} />
                {(() => {
                  const mine = disease ? results.filter((r) => r.diseases.includes(disease.id)) : results;
                  const others = disease ? results.filter((r) => !r.diseases.includes(disease.id)) : [];
                  return (
                    <>
                      <section>
                        <h2 className="text-[22px]">{disease ? `Researchers for ${disease.name}` : "Researchers"}</h2>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          {mine.map((r) => (
                            <ResearcherCard key={r.id} r={r} highlighted={highlight === r.id} />
                          ))}
                        </div>
                        {mine.length === 0 && <p className="mt-2 text-muted-foreground">No researchers match these filters.</p>}
                      </section>
                      {others.length > 0 && (
                        <section>
                          <h2 className="text-[22px]">Researchers across the cluster</h2>
                          <div className="mt-3 grid gap-4 md:grid-cols-2">
                            {others.map((r) => (
                              <ResearcherCard key={r.id} r={r} highlighted={highlight === r.id} />
                            ))}
                          </div>
                        </section>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            {tab === "organizations" && (
              <div className="grid gap-4 md:grid-cols-2">
                {orgResults.map((o) => (
                  <OrganizationCard key={o.id} o={o} />
                ))}
              </div>
            )}
            {tab === "patterns" && isResearch && <PatternsPanel />}
            {tab === "inquiries" && isResearch && (
              <section>
                <h2>Inquiries received</h2>
                <p className="mt-1 text-muted-foreground">Families choose to contact you. You see only what they approved.</p>
                <p className="mt-2 rounded-lg bg-tint-light p-3 text-sm">Demo inbox with fictional inquiries. In a live version, received inquiries appear only to a signed-in, verified organization or researcher account; switching the view does not grant access.</p>
                {inquiries.length === 0 ? (
                  <p className="mt-4 text-muted-foreground">
                    No inquiries yet. When a family chooses to contact you, it will appear here.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {inquiries.map((i) => (
                      <li
                        key={i.id}
                        className={`${card} space-y-2 ${i.id === highlightInquiryId ? "border-2 border-primary" : ""} ${i.status === "handled" ? "opacity-70" : ""}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {i.id === highlightInquiryId && (
                            <span className="rounded-full bg-accent px-2 text-sm font-bold text-accent-foreground">New</span>
                          )}
                          {i.status === "handled" && (
                            <span className="rounded-full bg-tint-light px-2 text-sm">Handled</span>
                          )}
                          <FictionalTag />
                        </div>
                        <h3>From {i.fromName}</h3>
                        <dl className="space-y-1 text-sm">
                          <div><dt className="inline text-muted-foreground">Condition (as entered): </dt><dd className="inline">{i.condition}</dd></div>
                          <div><dt className="inline text-muted-foreground">Question: </dt><dd className="inline">{i.question}</dd></div>
                          {i.note && <div><dt className="inline text-muted-foreground">Note: </dt><dd className="inline">{i.note}</dd></div>}
                          <div><dt className="inline text-muted-foreground">Sent to: </dt><dd className="inline">{i.recipientName}</dd></div>
                          <div><dt className="inline text-muted-foreground">Received: </dt><dd className="inline">{i.receivedDate}</dd></div>
                          <div>
                            <dt className="inline text-muted-foreground">Why it reached you: </dt>
                            <dd className="inline">
                              {i.whyItReachedYou}
                            </dd>
                          </div>
                        </dl>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            type="button"
                            className={btnPrimary}
                            onClick={() => toast("Reply drafted (simulated). Nothing is sent from this prototype.")}
                          >
                            Reply through official contact route
                          </button>
                          {i.status === "new" && (
                            <button type="button" className={btnSecondary} onClick={() => markHandled(i.id)}>
                              Mark as handled
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </div>

        <aside aria-labelledby="new-month">
          <div className={card}>
            <h2 id="new-month" className="text-[22px]">Recruiting studies</h2>
            <ul className="mt-4 space-y-4">
              {newThisMonth.map((f) => (
                <li key={f.id} className="space-y-1 border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="font-bold">{f.title}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {f.author} · {f.date} <SourceChip source={f.source} />
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Why it's relevant: </span>
                    {f.whyRelevant}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StudyCard({ s }: { s: Study }) {
  return (
    <article className={`${card} flex flex-col gap-2 ${s.highlight ? "border-2 border-[color:var(--evidence-mechanisms)] bg-[var(--violet-tint)]" : ""}`}>
      {s.highlight && <p className="font-bold">{s.highlight}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-tint-light px-2.5 py-0.5 text-[13px] font-bold">{s.type}</span>
        <span className="text-sm text-muted-foreground">{s.status.startsWith("Status") ? s.status : `Status: ${s.status || "Not reported"}`}</span>
      </div>
      <h3 className="text-lg">{s.title}</h3>
      <div className="flex flex-wrap gap-2">
        {s.diseases.map((id) => {
          const d = diseaseById(id);
          return d ? <PlateChip key={id} d={d} showNickname={false} /> : null;
        })}
      </div>
      <ExternalA href={s.url} className={`${btnSecondary} mt-auto self-start`}>View on ClinicalTrials.gov</ExternalA>
    </article>
  );
}

function StudiesGroup({ diseaseId }: { diseaseId: string | undefined }) {
  const list = diseaseId ? STUDIES.filter((s) => s.diseases.includes(diseaseId as Study["diseases"][number])) : STUDIES;
  const d = diseaseId ? diseaseById(diseaseId) : undefined;
  const designs = STUDIES.filter((s) => s.id === "nct07054515" || s.id === "nct04221451");
  return (
    <section aria-labelledby="studies">
      <h2 id="studies" className="text-[22px]">Studies and trials</h2>
      <p className="mt-1 text-sm font-bold">Relevant does not mean eligible.</p>
      {list.length > 0 ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {[...list].sort((a, b) => Number(!!b.highlight) - Number(!!a.highlight)).map((s) => <StudyCard key={s.id} s={s} />)}
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface p-5">
          <p>No studies added yet.</p>
          <ExternalA
            href={`https://clinicaltrials.gov/search?cond=${encodeURIComponent(d?.name ?? "")}`}
            className="inline-flex items-center gap-1 text-primary underline"
          >
            Search ClinicalTrials.gov
          </ExternalA>
          {diseaseId === "spg11" && (
            <div>
              <p className="mt-2 font-bold">Learn from GM2 and NPC trial designs</p>
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                {designs.map((s) => <StudyCard key={s.id} s={s} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
