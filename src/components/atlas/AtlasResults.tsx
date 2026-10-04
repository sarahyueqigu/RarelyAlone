import { useMemo, useState } from "react";
import { useExperience } from "@/lib/experience";
import { askAtlas } from "@/lib/atlas-live/atlas-browser";
import type { Edge, Node } from "@/lib/atlas-live/atlas-core";

type Source = { id: string; title: string; url: string; type: string; year?: string };
type Disease = { id: string; name: string; short?: string; plain?: string; coverage: { source: string; status: string; reason?: string; failures?: string[] }[] };
type Path = { id: string; dimension: string; pathA: string[]; pathB: string[] };
type Hypothesis = { candidate: string; status: string; rationale: string; existingEvidence: { summary: string; context: string; polarity: string; sourceIds: string[] }[]; missingEvidence: string; proposedExperiment: string; falsifier: string; sourceIds: string[] };
type Pair = { a: string; b: string; overall: number | null; confidence: number | null; coverage: number; association: boolean; strongest: string | null; metrics: { id: string; score: number | null; numerator: number; denominator: number }[]; paths: Path[]; counterevidence: string[]; hypotheses: Hypothesis[] };
export type AtlasResult = { query: string; generatedAt: string; diseases: Disease[]; nodes: Node[]; edges: Edge[]; sources: Source[]; comparisons: Pair[]; network: { nodes: { id: string; x: number; y: number }[]; note: string }; coverageWarning: string; indexSnapshot: { version: string; diseases: number }; cost: { llmCalls: number; httpRequests: number; estimatedOrReservedUSD: number } };
const format = (n: number | null | undefined) => n == null ? "Unknown" : n.toFixed(1);
const labels: Record<string, string> = { mechanism: "Mechanism", pathway: "Pathways", phenotype: "Symptoms & cell findings", molecular: "Molecules & substrates", assets: "Research assets" };
const url = (s: string) => /^https?:\/\//i.test(s) ? s : undefined;
function Sources({ ids, data }: { ids: string[]; data: AtlasResult }) {
  return <span className="inline-flex flex-wrap gap-x-3 gap-y-1">{[...new Set(ids)].map(id => { const s = data.sources.find(s => s.id === id); return s ? <a key={id} href={url(s.url)} target="_blank" rel="noreferrer" title={s.title} className="map-blue text-xs underline">{id} ↗</a> : null; })}</span>;
}
function exportResult(data: AtlasResult) {
  const a = document.createElement("a"), blob = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.href = blob; a.download = "atlas-research.json"; a.click(); setTimeout(() => URL.revokeObjectURL(blob), 1000);
}

export function AtlasResults({ data, onNewSearch }: { data: AtlasResult; onNewSearch: () => void }) {
  const [pair, setPair] = useState<Pair | null>(null);
  const names = Object.fromEntries(data.diseases.map(d => [d.id, d.name]));
  const nodes = useMemo(() => {
    const ns = data.network.nodes, xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
    const scale = Math.min(660 / (width || 1), 320 / (height || 1));
    return Object.fromEntries(ns.map(n => [n.id, { x: 500 + (n.x - minX - width / 2) * scale, y: 235 + (n.y - minY - height / 2) * scale }]));
  }, [data]);
  const associated = data.comparisons.filter(p => p.association);
  if (pair) return <PairEvidence key={pair.a + pair.b} data={data} pair={pair} back={() => setPair(null)} />;
  return <>
    <header className="mb-6 mt-10 max-w-3xl">
      <p className="map-blue text-xs uppercase">{data.diseases.length} diseases / computed neighborhood</p>
      <h1 className="mt-3 text-3xl md:text-5xl">Biological proximity</h1>
      <p className="mt-4 leading-relaxed opacity-70">{names[data.query]}. Closer points approximate stronger graph overlap. Select a line to inspect its evidence.</p>
      <div className="mt-5 flex gap-6 text-sm"><button className="map-blue underline" onClick={onNewSearch}>New search</button><button className="map-blue underline" onClick={() => exportResult(data)}>Download evidence JSON</button></div>
    </header>
    <div className="overflow-x-auto border-y map-rule">
      <svg viewBox="0 0 1000 510" className="w-full min-w-[650px]" role="group" aria-label="Live disease proximity graph">
        {associated.map(p => { const a = nodes[p.a]!, b = nodes[p.b]!; return <g key={p.a + p.b} tabIndex={0} role="button" aria-label={`${names[p.a]} and ${names[p.b]}, similarity ${format(p.overall)}`} className="group cursor-pointer" onClick={() => setPair(p)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPair(p); } }}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={30} /><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-primary/40 group-hover:stroke-primary group-focus:stroke-primary" strokeWidth={2 + (p.overall || 0) / 30} /></g>; })}
        {data.diseases.map(d => { const p = nodes[d.id]!; const focus = d.id === data.query; const words = d.name.match(/.{1,27}(?:\s|$)|\S{1,27}/g) || [d.name]; return <g key={d.id}><title>{d.name} · {d.id}</title>{focus && <circle cx={p.x} cy={p.y} r={25} className="fill-primary/10" />}<circle cx={p.x} cy={p.y} r={focus ? 12 : 9} className={focus ? "fill-primary" : "fill-surface stroke-primary"} strokeWidth={2} /><text x={p.x} y={p.y + 32} textAnchor="middle" className="fill-foreground text-[14px]">{words.slice(0,3).map((w, i) => <tspan key={i} x={p.x} dy={i ? 18 : 0}>{w.trim()}</tspan>)}</text></g>; })}
      </svg>
    </div>
    <p className="mt-3 text-xs opacity-60">{data.network.note} Lines indicate observed overlap, not proven disease equivalence. {associated.length === 0 && "No shared association was supported by the retrieved profiles."}</p>
    <div className="my-10 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b map-rule text-xs opacity-60"><th className="py-3">Pair</th><th>Similarity</th><th>Strongest shared finding</th><th>Evidence confidence</th></tr></thead><tbody>{data.comparisons.map(p => <tr key={p.a + p.b} className="border-b map-rule"><td className="max-w-sm py-5 pr-5"><button className="map-blue text-left underline" onClick={() => setPair(p)}>{names[p.a]} ↔ {names[p.b]}</button><p className="mt-1 text-xs opacity-60">Exploratory · {p.coverage}/5 dimensions observed</p></td><td className="pr-5 font-mono">{format(p.overall)}{p.overall != null && " / 100"}</td><td className="max-w-xs pr-5">{data.nodes.find(n => n.id === p.strongest)?.label || "No shared finding"}</td><td className="font-mono">{format(p.confidence)}</td></tr>)}</tbody></table></div>
    <Coverage data={data} />
  </>;
}

function PairEvidence({ data, pair, back }: { data: AtlasResult; pair: Pair; back: () => void }) {
  const { experience } = useExperience(), patient = experience === "patients";
  const [tab, setTab] = useState("paths"), [selected, setSelected] = useState<string | null>(null);
  const nodeMap = Object.fromEntries(data.nodes.map(n => [n.id, n]));
  const edgeMap = Object.fromEntries(data.edges.map(e => [e.id, e]));
  const A = data.diseases.find(d => d.id === pair.a)!, B = data.diseases.find(d => d.id === pair.b)!;
  const ledger = data.edges.filter(e => e.disease === pair.a || e.disease === pair.b);
  const negative = ledger.filter(e => e.polarity !== "support" || e.contradictions.length);
  const assets = data.nodes.filter(n => ["treatment/intervention", "research asset", "experimental model", "clinical study", "researcher", "patient organization"].includes(n.type) && ledger.some(e => e.target === n.id));
  const tabs = [["paths", patient ? "How they connect" : "Evidence graph & paths"], ["ledger", "Evidence ledger"], ["counter", "Uncertainty & counterevidence"], ["assets", "Interventions & assets"], ["hypotheses", "Research hypotheses"], ["sources", "Publications & sources"]];
  const evidence = (e: Edge) => <article key={e.id} className="border-b map-rule py-5 text-sm"><p className="font-medium">{nodeMap[e.source]?.label} → {e.relationship} → {nodeMap[e.target]?.label}</p><p className="mt-2 leading-relaxed">{e.summary}</p><p className="mt-2 text-xs opacity-60">{e.direct ? "Direct" : "Inferred"} · {e.evidenceType} · confidence {Math.round(e.confidence * 100)} · {e.polarity} · {e.context}</p><div className="mt-3"><Sources ids={e.sourceIds} data={data} /></div>{e.contradictions.map((c, i) => <p key={i} className="mt-3 border-l-2 border-amber-600 pl-3">{c.summary} <Sources ids={[c.sourceId]} data={data} /></p>)}</article>;
  function chain(ids: string[], disease: string, reverse = false) {
    const es = ids.map(id => edgeMap[id]).filter((e): e is Edge => !!e), vertices = [disease, ...es.map(e => e.target)];
    if (reverse) vertices.reverse();
    return <div className="flex flex-wrap items-center gap-2">{vertices.map((id, i) => <span key={id + i} className="contents">{i > 0 && <button className="map-blue max-w-44 text-center text-[11px] underline" onClick={() => setSelected(es[reverse ? es.length - i : i - 1]!.id)}>{reverse ? "←" : "→"} {es[reverse ? es.length - i : i - 1]!.relationship}</button>}<button className="rounded-md border map-rule bg-surface px-3 py-2 text-sm hover:border-primary" onClick={() => setSelected(id)}>{nodeMap[id]?.label || id}</button></span>)}</div>;
  }
  const selectedEdge = selected ? edgeMap[selected] : undefined;
  const selectedEvidence = selectedEdge ? [selectedEdge] : ledger.filter(e => e.source === selected || e.target === selected);
  return <div className="mt-10">
    <button className="map-blue text-sm underline" onClick={back}>← Back to proximity graph</button>
    <p className="map-blue mt-8 text-xs uppercase">Exploratory evidence overlap · automated, unreviewed</p>
    <h1 className="mt-3 max-w-4xl text-3xl leading-tight md:text-4xl">{A.name} ↔ {B.name}</h1>
    <p className="mt-5 max-w-3xl text-sm leading-relaxed opacity-70">{patient ? "These conditions may share some biological changes. That does not mean they are the same condition or that the same treatment will help. The findings below come from a limited research search." : "Similarity is the equal mean of observed dimensions, each calculated with confidence- and IDF-weighted Jaccard overlap along disease-local graph paths. Missing dimensions remain unknown. Confidence is a heuristic, not a clinical probability."}</p>
    <div className="my-9 grid grid-cols-2 gap-x-8 gap-y-6 border-y map-rule py-6 md:grid-cols-6"><div><p className="text-xs opacity-60">Overall / 100</p><p className="mt-2 font-mono text-3xl">{format(pair.overall)}</p></div>{pair.metrics.map(m => <div key={m.id}><p className="text-xs opacity-60">{labels[m.id]}</p><p className="mt-2 font-mono text-xl">{format(m.score)}</p></div>)}</div>
    {patient && <AskPanel key={pair.a + pair.b + "patient"} data={data} pair={pair} patient initialQuestion="Explain what each of these diseases is, why they may share biology, what is known and uncertain, and why it could matter for research. Use only this graph." />}
    <nav aria-label="Pair evidence sections" className="mb-6 flex flex-wrap gap-5 border-b map-rule pb-4">{tabs.map(([id, label]) => <button key={id} onClick={() => { setTab(id!); setSelected(null); }} className={`text-sm ${tab === id ? "map-blue font-semibold underline underline-offset-8" : "opacity-60"}`}>{label}</button>)}</nav>
    {tab === "paths" && <section className="space-y-8">{!pair.paths.length && <p>No shared evidence path was established. Missing paths are not filled in by the model.</p>}{pair.paths.map(p => <article key={p.id} className="border-b map-rule pb-8"><p className="mb-4 text-xs uppercase opacity-60">{labels[p.dimension]} · {nodeMap[p.id]?.label}</p>{chain(p.pathA, pair.a)}<div className="mt-3">{chain(p.pathB, pair.b, true)}</div><div className="mt-4"><Sources ids={[...p.pathA, ...p.pathB].flatMap(id => edgeMap[id]?.sourceIds || [])} data={data} /></div></article>)}</section>}
    {tab === "ledger" && <section>{ledger.map(evidence)}</section>}
    {tab === "counter" && <section><p className="mb-4 text-sm opacity-70">Differences in genotype, affected tissues, model systems and intervention exposure can prevent transfer. Missing evidence is an unresolved gap, not proof of equivalence.</p>{negative.length ? negative.map(evidence) : <p>No explicit contradictory finding was captured in this bounded search. That does not show that none exists.</p>}</section>}
    {tab === "assets" && <section>{!assets.length && <p>No reusable assets were captured.</p>}{assets.map(n => <details key={n.id} className="border-b map-rule py-4"><summary className="cursor-pointer text-sm">{n.label} <span className="ml-2 text-xs opacity-60">{n.type}</span></summary>{ledger.filter(e => e.target === n.id).map(evidence)}</details>)}</section>}
    {tab === "hypotheses" && <section className="space-y-8"><p className="text-sm opacity-70">Research proposals, not treatment recommendations.</p>{!pair.hypotheses.length && <p>Insufficient shared mechanistic evidence or research assets to generate a supported proposal.</p>}{pair.hypotheses.map((h, i) => <article key={i} className="space-y-4 border-b map-rule pb-8"><h2 className="text-2xl">{h.candidate}</h2><p><strong>Rationale: </strong>{h.rationale}</p><div><strong>Existing evidence:</strong>{h.existingEvidence.map((e, j) => <p key={j} className="mt-2 text-sm">{e.summary} ({e.context}; {e.polarity}) <Sources ids={e.sourceIds} data={data} /></p>)}</div><p><strong>Missing evidence: </strong>{h.missingEvidence}</p><p><strong>Proposed experiment: </strong>{h.proposedExperiment}</p><p><strong>What would weaken it: </strong>{h.falsifier}</p><Sources ids={h.sourceIds} data={data} /></article>)}</section>}
    {tab === "sources" && <section>{data.sources.filter(s => ledger.some(e => e.sourceIds.includes(s.id) || e.contradictions.some(c => c.sourceId === s.id))).map(s => <article key={s.id} className="border-b map-rule py-4"><a href={url(s.url)} target="_blank" rel="noreferrer" className="map-blue underline">{s.title} ↗</a><p className="mt-1 text-xs opacity-60">{s.id} · {s.type} · {s.year}</p></article>)}</section>}
    {selected && <section className="my-8 rounded-md border border-primary/30 bg-surface p-6" aria-label="Selected graph evidence"><div className="flex items-start justify-between gap-5"><h2 className="text-xl">{selectedEdge ? "Evidence for this connection" : nodeMap[selected]?.label}</h2><button className="map-blue text-sm underline" onClick={() => setSelected(null)}>Close</button></div>{selectedEvidence.map(evidence)}</section>}
    {!patient && <AskPanel data={data} pair={pair} patient={false} />}
    <Coverage data={{ ...data, diseases: [A, B] }} />
  </div>;
}

function AskPanel({ data, pair, patient, initialQuestion = "" }: { data: AtlasResult; pair: Pair; patient: boolean; initialQuestion?: string }) {
  const [question, setQuestion] = useState(initialQuestion), [answer, setAnswer] = useState<{ answer: string; uncertainty: string; sourceIds: string[] } | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function ask() {
    setBusy(true); setError("");
    try {
      const terms = question.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
      const all = data.edges.filter(e => e.disease === pair.a || e.disease === pair.b);
      const pathIds = new Set(pair.paths.slice(0, 3).flatMap(p => [...p.pathA, ...p.pathB]));
      const evidence = [...all].sort((a, b) => {
        const rank = (e: Edge) => terms.filter(t => (e.summary + " " + e.relationship).toLowerCase().includes(t)).length + (pathIds.has(e.id) ? 2 : 0) + (e.polarity !== "support" ? 2 : 0);
        return rank(b) - rank(a);
      }).slice(0, 24);
      const ids = new Set([...evidence.flatMap(e => [...e.sourceIds, ...e.contradictions.map(c => c.sourceId)]), ...pair.hypotheses.flatMap(h => h.sourceIds)]);
      const nodes = Object.fromEntries(data.nodes.map(n => [n.id, n.label]));
      setAnswer(await askAtlas({ question, audience: patient ? "patient / caregiver" : "researcher", diseases: data.diseases.filter(d => d.id === pair.a || d.id === pair.b).map(d => ({ name: d.name, plain: d.plain || "No curated definition in this retrieved snapshot" })), comparison: { overall: pair.overall, metrics: pair.metrics }, evidence: evidence.map(e => ({ id: e.id, subject: nodes[e.source], target: nodes[e.target], summary: e.summary, relationship: e.relationship, sourceIds: e.sourceIds, type: e.evidenceType, direct: e.direct, context: e.context, polarity: e.polarity, contradictions: e.contradictions })), hypotheses: pair.hypotheses.slice(0, 2), sources: data.sources.filter(s => ids.has(s.id)), coverage: data.coverageWarning }));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <section className="my-10 max-w-3xl rounded-md border map-rule p-5 md:p-7"><h2 className="text-2xl">{patient ? "Understand this connection" : "Ask the Atlas"}</h2><p className="mb-5 mt-2 text-xs opacity-60">Retrieves this pair's graph evidence first, then explains it with citations.</p><form onSubmit={e => { e.preventDefault(); void ask(); }} className="flex items-start gap-3"><label className="sr-only" htmlFor={patient ? "patient-atlas-question" : "atlas-question"}>Question</label><textarea id={patient ? "patient-atlas-question" : "atlas-question"} value={question} onChange={e => setQuestion(e.target.value)} maxLength={600} placeholder="Why did these diseases cluster? What experiment would test this connection?" className="min-h-20 min-w-0 flex-1 rounded border map-rule bg-transparent p-3 text-sm" /><button disabled={busy || question.trim().length < 3} className="rounded bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-50">{busy ? "Reading…" : patient ? "Explain" : "Ask"}</button></form>{error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{answer && <div className="mt-6 space-y-4 text-sm leading-relaxed"><p className="whitespace-pre-line">{answer.answer}</p><p className="opacity-70">{answer.uncertainty}</p><Sources ids={answer.sourceIds} data={data} /></div>}</section>;
}

function Coverage({ data }: { data: AtlasResult }) {
  return <details className="my-10 border-t map-rule pt-5 text-sm"><summary className="cursor-pointer">Source coverage & method</summary><p className="mt-4 max-w-3xl opacity-70">{data.coverageWarning}</p><p className="mt-3 text-xs opacity-60">{data.indexSnapshot?.diseases} indexed diseases · {data.cost?.httpRequests} source requests · {data.cost?.llmCalls} extraction calls · estimated/reserved model cost ${Number(data.cost?.estimatedOrReservedUSD || 0).toFixed(3)} (Ask calls excluded). Generated {data.generatedAt}.</p>{data.diseases.map(d => <div key={d.id} className="mt-5"><h3 className="font-medium">{d.name}</h3><ul className="mt-2 space-y-2">{d.coverage.map((c, i) => <li key={i}><strong>{c.source}:</strong> {c.status.replaceAll("_", " ")}{c.reason ? ` — ${c.reason}` : ""}{c.failures?.length ? ` — ${c.failures.join("; ")}` : ""}</li>)}</ul></div>)}</details>;
}
