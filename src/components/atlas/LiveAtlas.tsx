import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { atlasCall, LAST_JOB, pause } from "@/lib/atlas-live/atlas-browser";
import { AtlasResults, type AtlasResult } from "./AtlasResults";

export function LiveAtlas({ initialQuery, onBack }: { initialQuery: string; onBack: () => void }) {
  const [text, setText] = useState(initialQuery);
  const [matches, setMatches] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AtlasResult | null>(null);
  const [resume, setResume] = useState("");
  const [searched, setSearched] = useState(false);
  const [modelEnabled, setModelEnabled] = useState(true);
  const alive = useRef(true), running = useRef(false);
  const request = useRef<{ disease: string; id: string } | null>(null);

  useEffect(() => {
    alive.current = true;
    setResume(localStorage.getItem(LAST_JOB) || "");
    return () => { alive.current = false; };
  }, []);

  async function task(work: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try { await work(); } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  async function prepare() {
    setMessage("Opening your research cache…");
    const status: any = await atlasCall("status");
    setModelEnabled(status.llmEnabled);
    if (status.indexReady) return;
    // One reusable index, not a fresh research job for every known disease.
    while (alive.current) {
      const p: any = await atlasCall("bootstrap");
      const progress = p.totalBytes ? ` · ${Math.round(100 * p.bytes / p.totalBytes)}%` : "";
      setMessage(`Preparing the disease index · ${p.file || p.phase}${progress}. First use takes several minutes; progress is saved.`);
      if (p.ready) return;
      await pause(p.busy ? 1000 : 20);
    }
    throw Error("Paused");
  }
  function search() {
    if (text.trim().length < 2) return;
    void task(async () => {
      setResult(null); setMatches([]); setSearched(false);
      await prepare(); if (!alive.current) return;
      const r: any = await atlasCall("search", { query: text.trim() });
      setMatches(r.matches); setSearched(true); setMessage("");
    });
  }
  async function wait(jobId: string) {
    setResult(null); setMatches([]); setResume(jobId); localStorage.setItem(LAST_JOB, jobId);
    while (alive.current) {
      const j: any = await atlasCall("advance", { jobId });
      if (!alive.current) return;
      if (!j) throw Error("This job is not in this browser's cache. Start a new search.");
      if (j.status === "error") { request.current = null; throw Error(j.error || "Research failed"); }
      if (j.status === "complete") { setResult(j.result); setMessage(""); return; }
      const p = j.progress || {};
      setMessage(p.phase === "select" ? "Finding the most relevant neighbors in the index…" : p.phase === "compare" ? "Calculating graph similarity and research hypotheses…" : `Researching disease ${Math.min((p.completedDiseases || 0) + 1, p.totalDiseases || 1)} of ${p.totalDiseases || 1} · ${p.source || "evidence"}`);
      await pause(700);
    }
  }
  function choose(disease: string) {
    void task(async () => {
      if (request.current?.disease !== disease) request.current = { disease, id: crypto.randomUUID() };
      const r: any = await atlasCall("query", { disease, top_k: 3, requestId: request.current.id });
      await wait(r.jobId);
    });
  }

  return <div className="map-flow -mx-4 min-h-[calc(100vh-10rem)] px-6 py-10 md:-mx-6 md:px-10">
    <div className="mx-auto max-w-[1260px]">
      <button onClick={onBack} className="map-blue text-sm underline underline-offset-4">← Back to search</button>
      {!result && <header className="mb-10 mt-10 max-w-2xl">
        <p className="map-blue text-xs uppercase">Live evidence / research preview</p>
        <h1 className="mt-3 text-3xl md:text-5xl">Explore beyond the five.</h1>
        <p className="mt-5 leading-relaxed opacity-70">Find a disease, then investigate its closest evidence-backed neighbors. Each disease is researched independently before comparisons are calculated.</p>
      </header>}
      {!result && <>
        <form onSubmit={e => { e.preventDefault(); search(); }} className="flex max-w-2xl gap-3">
          <label className="sr-only" htmlFor="live-disease">Search disease index</label>
          <input id="live-disease" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Fabry disease" disabled={busy} className="min-w-0 flex-1 rounded-md border map-rule bg-transparent px-4 py-3" />
          <button disabled={busy || text.trim().length < 2} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"><Search size={16} /> Search</button>
        </form>
        {!busy && resume && <button className="map-blue mt-4 text-sm underline" onClick={() => void task(() => wait(resume))}>Open / resume my last research</button>}
        {!modelEnabled && <p className="mt-5 text-sm text-amber-800">Lovable AI is not enabled. Structured annotations can be retrieved, but mechanistic extraction requires the project's AI connection.</p>}
        {matches.length > 0 && <div className="mt-8 max-w-2xl divide-y border-y map-rule">
          <p className="py-3 text-xs opacity-60">Select the exact disease or subtype to start research.</p>
          {matches.map(d => <button key={d.id} disabled={busy} onClick={() => choose(d.id)} className="flex w-full items-center justify-between gap-5 py-4 text-left hover:text-primary disabled:opacity-50"><span>{d.name}</span><span className="shrink-0 font-mono text-xs opacity-60">{d.id} ↗</span></button>)}
        </div>}
        {searched && !matches.length && !busy && !error && <p className="mt-6 max-w-2xl text-sm">No exact indexed concept matched. Try the full disease name or an OMIM / ORPHA ID. This index does not cover every disease.</p>}
        <p className="mt-8 max-w-2xl text-xs leading-relaxed opacity-60">The index and research jobs stay in this browser. Keep this page open while research runs; you can resume later on this device. Source availability varies. A desktop browser is recommended for the initial index download.</p>
      </>}
      {busy && <div className="my-10 flex items-start gap-3" role="status"><Loader2 className="mt-1 shrink-0 animate-spin" size={18} /><p className="max-w-2xl text-sm leading-relaxed">{message}</p></div>}
      {error && <div role="alert" className="my-6 max-w-2xl rounded-md border border-destructive/30 p-4 text-sm"><p>{error}</p><p className="mt-2 opacity-70">Retry Search to continue index setup, or resume the saved job. If another tab is using Atlas, close it and reload this page.</p></div>}
      {result && <AtlasResults data={result} onNewSearch={() => { setResult(null); setSearched(false); }} />}
    </div>
  </div>;
}
