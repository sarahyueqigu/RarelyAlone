import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ExternalLink } from "lucide-react";
import { pageHead } from "@/lib/seo";
import {
  compare,
  diseaseMap,
  dimensions,
  edgeMap,
  evidenceSources,
  nodeMap,
  pairs,
  snapshot,
  sourceMap,
  strongestPaths,
  type Edge,
} from "@/lib/atlas/graph";
import { caveats, hypotheses, patientExplanation } from "@/lib/atlas/hypotheses";
import { useExperience } from "@/lib/experience";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import "@/map-flow.css";

export const Route = createFileRoute("/map_/pair/$pairId")({
  validateSearch: (s) => z.object({ focus: z.enum(["tay", "sand", "npc", "gaucher", "spg"]).optional() }).parse(s),
  loader: ({ params }) => {
    const pair = pairs.find((p) => p.id === params.pairId);
    if (!pair) throw notFound();
    return { pairId: pair.id };
  },
  head: ({ loaderData }) => {
    const p = pairs.find((x) => x.id === loaderData?.pairId);
    if (!p) return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    return { ...pageHead(`${p.label} evidence`, `${p.role}: computed similarity, shared mechanisms, evidence ledger and sources for ${p.label}.`), links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap" }] };
  },
  notFoundComponent: () => (
    <div className="py-12">
      <h1>Connection not found</h1>
      <Link to="/map" className="mt-4 inline-block text-primary underline">← Back to disease map</Link>
    </div>
  ),
  component: PairPage,
});

const fmt = (n: number | null) => (n === null ? "Not reported" : Math.round(n).toString());
const pct = (n: number) => `${Math.round(n * 100)}%`;
type EvidenceTier = "Established biology" | "Preliminary research" | "Inferred hypothesis";
function tierForEdge(e: Edge): EvidenceTier {
  if (!e.direct || e.evidenceType.toLowerCase().includes("inferred")) return "Inferred hypothesis";
  if (/experiment|model|preclinical|cell|animal|mouse|intervention|trial|study/i.test(e.evidenceType)) return "Preliminary research";
  return "Established biology";
}
function tierForPaths(ids: string[]): EvidenceTier {
  const tiers = ids.map((id) => edgeMap[id]).filter((e): e is Edge => Boolean(e)).map(tierForEdge);
  if (tiers.includes("Inferred hypothesis")) return "Inferred hypothesis";
  if (tiers.includes("Preliminary research")) return "Preliminary research";
  return "Established biology";
}
function PathSources({ ids }: { ids: string[] }) {
  const sourceIds = [...new Set(ids.flatMap((id) => edgeMap[id]?.sourceIds ?? []))];
  return <span className="inline-flex flex-wrap gap-2">{sourceIds.map((id) => <SourceRef key={id} id={id} />)}</span>;
}

function SourceRef({ id }: { id: string }) {
  const s = sourceMap[id];
  if (!s) return <span className="font-mono text-xs">{id}</span>;
  return (
    <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.title} className="font-mono text-xs text-primary underline">
      {id}
      <span className="sr-only"> {s.title} (opens in a new tab)</span>
    </a>
  );
}

function PairPage() {
  const { experience } = useExperience();
  const patient = experience === "patients";
  const { pairId } = Route.useLoaderData();
  const { focus } = Route.useSearch();
  const pair = pairs.find((p) => p.id === pairId)!;
  const c = useMemo(() => compare(pair.a, pair.b), [pair]);
  const A = diseaseMap[pair.a]!, B = diseaseMap[pair.b]!;
  const paths = useMemo(() => strongestPaths(c), [c]);
  const mechanisms = c.shared.filter((f) => nodeMap[f.id]?.dimension === "mechanism").slice(0, 6);
  const pathEdgeIds = [...new Set(paths.flatMap((f) => [...f.pathA, ...f.pathB]))];
  const ledger = pathEdgeIds.map((id) => edgeMap[id]).filter(Boolean) as Edge[];
  const qualifying = [...new Map([...ledger, ...A.edges, ...B.edges].filter((e) => e.contradictions.length || e.polarity !== "support").map((e) => [e.id, e])).values()];
  const sources = [...new Set([
    ...evidenceSources([...ledger, ...qualifying]).filter((s): s is NonNullable<typeof s> => Boolean(s)).map((s) => s.id),
    ...patientExplanation(pair.id).sources,
    ...(caveats[pair.id as keyof typeof caveats] ?? []).flatMap((cv) => cv.sources),
    ...(pair.role === "Exploratory" ? hypotheses().flatMap((h) => h.sources) : []),
  ])].map((id) => sourceMap[id]).filter(Boolean);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const exploratory = pair.role === "Exploratory";
  const expl = patientExplanation(pair.id);
  const pairCaveats = caveats[pair.id as keyof typeof caveats] ?? [];
  type TabId = "graph" | "ledger" | "qualifying" | "hypotheses";
  const tabs: { id: TabId; label: string }[] = [
    { id: "graph", label: patient ? "How the evidence connects" : "Evidence graph & paths" },
    ...(!patient ? [{ id: "ledger" as const, label: "Evidence ledger" }] : []),
    { id: "qualifying", label: patient ? "Uncertainty & caveats" : "Contradictory or qualifying" },
    ...(exploratory ? [{ id: "hypotheses" as const, label: "Research hypotheses" }] : []),
  ];
  const [tab, setTab] = useState<TabId>("graph");
  const activeTab: TabId = tabs.some((t) => t.id === tab) ? tab : "graph";
  const [sort, setSort] = useState<{ key: "type" | "confidence" | null; dir: "asc" | "desc" }>({ key: null, dir: "desc" });
  const toggleSort = (key: "type" | "confidence") =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "confidence" ? "desc" : "asc" }));
  const sortedLedger = useMemo(() => {
    if (!sort.key) return ledger;
    const m = sort.dir === "asc" ? 1 : -1;
    return [...ledger].sort((x, y) =>
      sort.key === "confidence" ? (x.confidence - y.confidence) * m : x.evidenceType.localeCompare(y.evidenceType) * m,
    );
  }, [ledger, sort]);

  return (
    <div className="map-flow -mx-4 space-y-14 px-5 pb-20 pt-8 md:-mx-6 md:px-10 md:pt-12">
      <div className="map-reveal mx-auto max-w-[1260px]">
        <Link to="/map" search={focus ? { focus } : {}} className="map-blue inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
          ← Back to disease map
        </Link>
        <p className={`mt-7 w-fit border-l-2 pl-3 text-xs font-semibold uppercase ${exploratory ? "border-evidence-inferred" : "border-primary"}`}>
          {exploratory ? "Exploratory" : "Positive control"} · {pair.detail}
        </p>
        <h1 className="mt-4 max-w-5xl text-3xl leading-tight md:text-5xl">{A.name} <span className="map-blue font-normal">↔</span> {B.name}</h1>
        <p className="mt-5 text-sm opacity-70">
          {patient ? `Evidence reviewed ${snapshot.reviewed}. The same research sources are used in both views.` : `Snapshot ${snapshot.version}, reviewed ${snapshot.reviewed}. ${snapshot.method}.`}
        </p>
      </div>

      <section className="map-reveal-late mx-auto grid max-w-[1260px] gap-10 border-y map-rule py-10 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)] md:gap-16">
        <div className="border-l-4 border-primary pl-6">
          <p className="map-blue text-xs font-semibold uppercase">{patient ? "Shared biology in this evidence map" : "Overall similarity"}</p>
          <p className="mt-3 font-heading text-7xl leading-none map-ink">{fmt(c.overall)}<span className="ml-2 font-sans text-base font-normal opacity-60">/ 100</span></p>
          {patient ? <p className="mt-5 max-w-sm text-sm opacity-75">This number describes overlap in the research map. It cannot predict symptoms, prognosis, or whether a treatment will work.</p> : <p className="mt-5 max-w-sm text-sm opacity-75">Evidence confidence {fmt(c.confidence)} · {c.shared.length} shared features · {c.coverage}/5 dimensions</p>}
        </div>
        <div>
          <h2 className="text-xl md:text-2xl">{patient ? "Where they overlap" : "Similarity by dimension"}</h2>
          {patient && <p className="mt-1 text-sm text-muted-foreground">These are calculated comparisons of evidence, not measures of how similar two people's experiences will be.</p>}
          <ul className="mt-6 space-y-4">
            {c.metrics.map((m) => {
              const dim = dimensions.find((d) => d.id === m.id);
              if (!dim) return null;
              const plainLabel: Record<string, string> = { mechanism: "How cells are affected", pathway: "Cell processes", phenotype: "Observed features", molecular: "Molecules and stored materials", assets: "Research tools" };
              const label = patient ? plainLabel[m.id] ?? dim.label : dim.label;
              return (
                <li key={m.id}>
                  <div className="flex justify-between gap-4 text-sm"><span>{label}</span><span className="font-mono">{fmt(m.score)}</span></div>
                  <div className="mt-2 h-1 bg-primary/10" role="img" aria-label={`${label}: ${fmt(m.score)} of 100`}>
                    <div className="h-full bg-primary" style={{ width: `${m.score ?? 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="map-paper mx-auto max-w-[1260px] border-l-4 border-primary p-6 md:p-9">
        <h2 className="text-[22px]">{patient ? "What the evidence means" : "In plain words"}</h2>
        <dl className="mt-3 space-y-2">
          <div><dt className="inline font-bold">What is known: </dt><dd className="inline">{expl.known}</dd></div>
          <div><dt className="inline font-bold">What is uncertain: </dt><dd className="inline">{expl.uncertain}</dd></div>
          <div><dt className="inline font-bold">What it could mean: </dt><dd className="inline">{expl.meaning}</dd></div>
        </dl>
        <p className="mt-2 flex flex-wrap gap-2 text-sm">Sources: {expl.sources.map((s) => <SourceRef key={s} id={s} />)}</p>
      </section>

      {patient && <section aria-label="How to read this evidence" className="mx-auto grid max-w-[1260px] gap-5 md:grid-cols-3">
        <div className="border-l-4 border-evidence-documented bg-surface p-4"><h3 className="text-lg">Established biology</h3><p className="text-sm">Well-described disease biology in clinical references. This does not mean the diseases are the same.</p></div>
        <div className="border-l-4 border-evidence-assets bg-surface p-4"><h3 className="text-lg">Preliminary research</h3><p className="text-sm">Findings from cells, animals, or early studies. Results may not carry over to people.</p></div>
        <div className="border-l-4 border-evidence-inferred bg-surface p-4"><h3 className="text-lg">Inferred hypotheses</h3><p className="text-sm">Possible connections proposed from the evidence map; they still need testing.</p></div>
      </section>}

      <section className="mx-auto max-w-[1260px] border-t map-rule pt-9">
        <h2 className="text-[22px]">{patient ? "Shared cell processes" : "Strongest shared biological mechanisms"}</h2>
        <div className="mt-6 grid gap-x-12 gap-y-0 md:grid-cols-2">
          {mechanisms.map((f) => (
            <div key={f.id} className="border-b border-l-4 border-l-accent bg-tint-warm/50 px-4 py-5 map-rule">
              <p className="font-bold">{nodeMap[f.id]?.label}</p>
              <p className="text-sm text-muted-foreground">{nodeMap[f.id]?.description}</p>
              {patient ? <><p className="mt-2 text-sm font-bold text-evidence-inferred">{tierForPaths([...f.pathA, ...f.pathB])}</p><p className="mt-1 text-sm">Sources: <PathSources ids={[...f.pathA, ...f.pathB]} /></p></> : <p className="mt-2 font-mono text-xs">{A.short} {pct(f.a)} · {B.short} {pct(f.b)} · weight {f.idf.toFixed(2)}</p>}
            </div>
          ))}
          {mechanisms.length === 0 && <p className="text-muted-foreground">No shared mechanism-level features in this snapshot.</p>}
        </div>
      </section>

      <div className="mx-auto max-w-[1260px] border-t map-rule pt-6">
        <div role="tablist" aria-label="Evidence sections" className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={activeTab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${activeTab === t.id ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "graph" && <section role="tabpanel" id="panel-graph" aria-labelledby="tab-graph" className="mx-auto max-w-[1260px] !mt-6">
        <h2 className="text-[22px]">{patient ? "How the evidence connects" : "Evidence graph and mechanistic paths"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each row traces how {A.short} (left) and {B.short} (right) reach a shared feature (center). Select a node to see what it means and review its sources.
        </p>
        <EvidenceGraph paths={paths} a={A.short} b={B.short} selected={selectedNode} onSelect={setSelectedNode} />
      </section>}

      {activeTab === "ledger" && <section role="tabpanel" id="panel-ledger" aria-labelledby="tab-ledger" className="mx-auto max-w-[1260px] !mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[22px]">Evidence ledger</h2>
          <p className="text-xs text-muted-foreground">{ledger.length} claims · select a column header to sort</p>
        </div>
        <div className="mt-4 overflow-x-auto border-y border-border bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-semibold">Claim</th>
                <th scope="col" aria-sort={sort.key === "type" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2.5 font-semibold">
                  <button onClick={() => toggleSort("type")} className="inline-flex items-center gap-1 uppercase hover:text-foreground">Evidence type <span aria-hidden>{sort.key === "type" ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span></button>
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Context</th>
                <th scope="col" aria-sort={sort.key === "confidence" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2.5 text-right font-semibold">
                  <button onClick={() => toggleSort("confidence")} className="inline-flex items-center gap-1 uppercase hover:text-foreground">Confidence <span aria-hidden>{sort.key === "confidence" ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span></button>
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Sources</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedLedger.map((e) => (
                <tr key={e.id} className="align-top hover:bg-tint-warm/40">
                  <td className="max-w-md px-3 py-2.5 leading-snug">
                    <span title={e.summary}>{nodeMap[e.source]?.label} {e.relationship} {nodeMap[e.target]?.label}</span>
                  </td>
                  <td className="px-3 py-2.5">{e.evidenceType}{!e.direct && <span className="ml-1.5 text-xs text-evidence-inferred">Inferred</span>}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.context}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{e.confidence.toFixed(2)}</td>
                  <td className="px-3 py-2.5"><span className="flex flex-wrap gap-1.5">{e.sourceIds.map((s) => <SourceRef key={s} id={s} />)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>}

      {activeTab === "qualifying" && <section role="tabpanel" id="panel-qualifying" aria-labelledby="tab-qualifying" className="mx-auto max-w-[1260px] !mt-6">
        <h2 className="text-[22px]">Contradictory or qualifying evidence</h2>
        <ul className="mt-4 space-y-3">
          {pairCaveats.map((cv) => (
            <li key={cv.title} className="rounded-lg border-l-4 border-evidence-inferred bg-surface p-4">
              <p className="font-bold">{cv.title}</p>
              <p className="mt-1">{cv.text}</p>
              <p className="mt-1 flex flex-wrap gap-2 text-sm">{cv.sources.map((s) => <SourceRef key={s} id={s} />)}</p>
            </li>
          ))}
          {qualifying.flatMap((e) => [
            ...e.contradictions.map((ct, i) => (
              <li key={`${e.id}-${i}`} className="rounded-lg border-l-4 border-evidence-contradicted bg-surface p-4">
                <p className="text-sm font-bold text-evidence-contradicted">Contradiction · {diseaseMap[e.disease]?.short}</p>
                <p className="mt-1">{nodeMap[e.source]?.label} {e.relationship} {nodeMap[e.target]?.label}: {ct.summary}</p>
                <p className="mt-1 text-sm"><SourceRef id={ct.sourceId} /></p>
              </li>
            )),
            ...(e.polarity !== "support"
              ? [
                  <li key={`${e.id}-pol`} className="rounded-lg border-l-4 border-evidence-contradicted bg-surface p-4">
                    <p className="text-sm font-bold text-evidence-contradicted">{e.polarity} · {diseaseMap[e.disease]?.short}</p>
                    <p className="mt-1">{e.summary}</p>
                    <p className="mt-1 flex flex-wrap gap-2 text-sm">{e.sourceIds.map((s) => <SourceRef key={s} id={s} />)}</p>
                  </li>,
                ]
              : []),
          ])}
        </ul>
      </section>}

      {exploratory && activeTab === "hypotheses" && (
        <section role="tabpanel" id="panel-hypotheses" aria-labelledby="tab-hypotheses" className="mx-auto max-w-[1260px] !mt-6">
          <h2 className="text-[22px]">Research hypotheses</h2>
          <p className="mt-1 text-sm text-muted-foreground">{patient ? "Ideas for researchers to investigate, not treatments for people to try. A laboratory result does not show that a medicine works in people." : "Proposals to test, not treatment suggestions."}</p>
          <div className="mt-4 space-y-4">
            {hypotheses().map((h) => (
              <article key={h.id} className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                <p className="text-sm font-bold text-evidence-inferred">{patient ? "Inferred hypothesis · Research only" : h.status}</p>
                <h3 className="text-xl">{patient ? (nodeMap[h.feature]?.label ?? h.feature) : h.asset}</h3>
                {patient ? <><p><strong>Why researchers are looking: </strong>{h.rationale}</p><p><strong>What has been studied: </strong>{h.existing}</p><p><strong>What is not known: </strong>{h.missing}</p><p className="rounded-lg bg-tint-warm p-3">This is not a treatment recommendation. Existing laboratory findings and trials do not establish benefit for SPG11.</p></> : <><p><strong>Why: </strong>{h.rationale}</p><p><strong>What exists: </strong>{h.existing}</p><p><strong>What is missing: </strong>{h.missing}</p><p><strong>Proposed experiment: </strong>{h.experiment}</p><p className="rounded-lg bg-tint-warm p-3"><strong>What would weaken it: </strong>{h.falsifier}</p></>}
                <p className="flex flex-wrap gap-2 text-sm">Sources: {h.sources.map((s) => <SourceRef key={s} id={s} />)}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1260px] border-t map-rule pt-9">
        <h2 className="text-[22px]">Source citations</h2>
        <ol className="mt-4 space-y-2">
          {sources.map((s) => (
            <li key={s!.id} className="text-sm">
              <span className="font-mono">{s!.id}</span>{" "}
              <a href={s!.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                {s!.title} <ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span className="text-muted-foreground"> · {s!.type}, {s!.year}</span>
            </li>
          ))}
        </ol>
      </section>

      <Link to="/map" search={focus ? { focus } : {}} className="inline-block text-primary underline">← Back to disease map</Link>

      <NodeEvidenceSheet
        nodeId={selectedNode}
        edgeIds={pathEdgeIds}
        patient={patient}
        open={selectedNode !== null}
        onOpenChange={(open) => { if (!open) setSelectedNode(null); }}
      />
    </div>
  );
}

function NodeEvidenceSheet({ nodeId, edgeIds, patient, open, onOpenChange }: { nodeId: string | null; edgeIds: string[]; patient: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const node = nodeId ? nodeMap[nodeId] : undefined;
  const relatedEdges = nodeId
    ? edgeIds.map((id) => edgeMap[id]).filter((e): e is Edge => {
        if (!e) return false;
        return e.source === nodeId || e.target === nodeId;
      })
    : [];
  const sourceIds = [...new Set(relatedEdges.flatMap((e) => e.sourceIds))];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l-accent sm:max-w-md">
        <SheetHeader className="pr-8">
          <p className="w-fit bg-accent px-2 py-1 text-xs font-bold uppercase text-accent-foreground">Selected node</p>
          <SheetTitle className="font-heading text-2xl">{node?.label ?? nodeId}</SheetTitle>
          <SheetDescription className="text-base leading-relaxed">{node?.description || "No description is reported for this disease node."}</SheetDescription>
        </SheetHeader>
        <div className="mt-8 space-y-6">
          {relatedEdges.map((e) => (
            <article key={e.id} className="border-l-4 border-accent bg-tint-warm/50 p-4">
              <p className="font-bold">{nodeMap[e.source]?.label} → {nodeMap[e.target]?.label}</p>
              <p className="mt-2 text-sm leading-relaxed">{e.summary}</p>
              <p className="mt-3 text-sm text-muted-foreground">{patient ? `${tierForEdge(e)} · Studied in: ${e.context}` : `${e.evidenceType} · ${e.context} · confidence ${e.confidence.toFixed(2)} · ${e.direct ? "Direct" : "Inferred"}`}</p>
            </article>
          ))}
          <div>
            <h3 className="font-heading text-lg">Sources</h3>
            {sourceIds.length > 0 ? <ul className="mt-3 space-y-3">{sourceIds.map((id) => {
              const source = sourceMap[id];
              return <li key={id} className="text-sm"><SourceRef id={id} />{source && <span className="ml-2 text-muted-foreground">{source.title}</span>}</li>;
            })}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sources are attached to the connecting evidence rather than this node itself.</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EvidenceGraph({
  paths, a, b, selected, onSelect,
}: {
  paths: ReturnType<typeof strongestPaths>; a: string; b: string; selected: string | null; onSelect: (id: string) => void;
}) {
  const W = 1100, ROW = 96, CXC = W / 2;
  const H = Math.max(paths.length, 1) * ROW + 40;
  const label = (id: string) => {
    const l = nodeMap[id]?.label ?? id;
    return l.length > 18 ? `${l.slice(0, 17)}…` : l;
  };
  return (
    <div className="map-paper mt-6 overflow-x-auto border-y map-rule py-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[760px] w-full" role="group" aria-label="Evidence graph">
        <text x={20} y={20} className="fill-muted-foreground text-[13px] font-bold">{a}</text>
        <text x={W - 20} y={20} textAnchor="end" className="fill-muted-foreground text-[13px] font-bold">{b}</text>
        {paths.map((f, row) => {
          const y = 60 + row * ROW;
          const side = (edgeIds: string[], dir: 1 | -1) => {
            const n = edgeIds.length;
            const xs = Array.from({ length: n + 1 }, (_, i) => (dir === 1 ? 40 : W - 40) + dir * ((CXC - 40 - 90) * i) / Math.max(n, 1));
            if (n) xs[n] = CXC - dir * 90;
            const nodes = [edgeIds.length ? edgeMap[edgeIds[0]!]!.source : f.id, ...edgeIds.map((id) => edgeMap[id]!.target)];
            return { xs, nodes };
          };
          const L = side(f.pathA, 1), R = side(f.pathB, -1);
          const draw = (s: typeof L, ids: string[], key: string) => (
            <g key={key}>
              {ids.map((id, i) => {
                const e = edgeMap[id]!;
                return (
                  <line key={id} x1={s.xs[i]} y1={y} x2={s.xs[i + 1]} y2={y} className={e.direct ? "stroke-primary/50" : "stroke-evidence-inferred"} strokeWidth={3} strokeDasharray={e.direct ? undefined : "6 5"} />
                );
              })}
              {s.nodes.slice(0, -1).map((nid, i) => {
                const x = s.xs[i] ?? 0;
                return <g key={nid + i} role="button" tabIndex={0} aria-label={`View ${nodeMap[nid]?.label ?? nid}`}
                  className="evidence-node cursor-pointer focus:outline-none"
                  onClick={() => onSelect(nid)}
                  onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onSelect(nid))}>
                  <circle cx={x} cy={y} r={selected === nid ? 10 : 7} className={i === 0 ? "fill-primary stroke-background" : "fill-tint stroke-primary"} strokeWidth={3} />
                  <g className="node-tooltip pointer-events-none">
                    <rect x={x - 95} y={y - 51} width={190} height={32} rx={4} className="fill-foreground" />
                    <text x={x} y={y - 31} textAnchor="middle" className="fill-background text-[11px] font-bold">{label(nid)}</text>
                  </g>
                </g>
              })}
            </g>
          );
          return (
            <g key={f.id}>
              {draw(L, f.pathA, "l")}
              {draw(R, f.pathB, "r")}
              <g role="button" tabIndex={0} aria-label={`View shared feature ${nodeMap[f.id]?.label ?? f.id}`}
                className="evidence-node cursor-pointer focus:outline-none"
                onClick={() => onSelect(f.id)}
                onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onSelect(f.id))}>
                <rect x={CXC - 100} y={y - 19} width={200} height={38} rx={4} className="fill-accent stroke-accent-foreground/20" strokeWidth={selected === f.id ? 3 : 1} />
                <text x={CXC} y={y + 5} textAnchor="middle" className="fill-accent-foreground text-[12px] font-bold">{label(f.id)}</text>
              </g>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 px-2 text-xs text-muted-foreground">Solid: direct evidence. Dashed orange: inferred. Yellow: shared feature. Select any node for its meaning, evidence, and source citations.</p>
    </div>
  );
}
