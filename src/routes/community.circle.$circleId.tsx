import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { useCommunity } from "@/lib/community-store";
import { allCommunities, type Community } from "@/data/community";
import { ATLAS_ID, CLUSTER_RESEARCHERS, DISEASES, LAST_VERIFIED, STUDIES, diseaseById, isDiseaseId, type DiseaseId } from "@/data/diseases";
import { edgeBetween, STRENGTH_LABELS } from "@/data/edges";
import { pairs } from "@/lib/atlas/graph";
import { getSharedResearchAssets } from "@/lib/atlas/resources";
import { biologyConnections } from "@/data/circle-connections";
import { organizations } from "@/data/community";
import { ExternalA, FictionalTag, RealTag, btnPrimary, btnSecondary, card } from "@/components/community/bits";

export const CIRCLE_LABEL: Record<Community["connectionType"], string> = {
  exact: "Same diagnosis",
  related_biology: "Related biology",
  shared_challenge: "Shared daily challenges",
  undiagnosed: "Shared daily challenges",
};
const circleLabel = (c: Community) => (c.closest ? "Broader support organization" : CIRCLE_LABEL[c.connectionType]);

export const Route = createFileRoute("/community/circle/$circleId")({
  loader: ({ params }) => {
    const c = allCommunities().find((x) => x.id === params.circleId);
    if (!c) throw notFound();
    return { name: c.name };
  },
  head: ({ loaderData }) =>
    pageHead(loaderData ? `${loaderData.name} circle` : "Circle not found", "People, research and a shared next step for this circle."),
  notFoundComponent: () => (
    <div className="py-10">
      <h1>No circle found</h1>
      <p className="mt-2">No exact community found in the sources we checked.</p>
      <Link to="/community" className={`${btnPrimary} mt-4`}>Back to Find My Circle</Link>
    </div>
  ),
  component: CirclePage,
});

type Tab = "people" | "research" | "next";
const TABS: { id: Tab; label: string }[] = [
  { id: "people", label: "People & experiences" },
  { id: "research", label: "Research & resources" },
  { id: "next", label: "Our next step" },
];

function pairFor(a: DiseaseId, b: DiseaseId) {
  const x = ATLAS_ID[a], y = ATLAS_ID[b];
  return pairs.find((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x));
}

function CirclePage() {
  const { circleId } = Route.useParams();
  const c = allCommunities().find((x) => x.id === circleId)!;
  const { condition } = useCommunity();
  const [tab, setTab] = useState<Tab>("people");
  const selected = isDiseaseId(condition) ? condition : undefined;
  const circleDiseases = c.exactFor.filter(isDiseaseId);
  const home = c.diseaseId ?? circleDiseases[0];
  const scope = [...new Set([...(selected ? [selected] : []), ...circleDiseases])];
  const edge = selected && home && selected !== home ? edgeBetween(selected, home) : undefined;
  const pair = selected && home && selected !== home ? pairFor(selected, home) : undefined;

  return (
    <div>
      <Link to="/community" className="text-primary underline">← Back to Find My Circle</Link>
      <section className="mt-4 rounded-3xl bg-tint-warm p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface px-3 py-1 text-sm">{circleLabel(c)}</span>
          <span className="rounded-full bg-surface px-3 py-1 text-sm">Demo circle</span>
        </div>
        <h1 className="mt-3">{c.name} demo circle</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A simulated discussion space in Rarely Alone{c.isReal ? `. It is not run or endorsed by ${c.runBy}.` : ". This community is fictional."}
        </p>
        {selected && <p className="mt-1 text-sm text-muted-foreground">Showing for {diseaseById(selected)!.name}.</p>}
      </section>
      {c.isReal && (
        <section className={`${card} mt-4`} aria-label="About the organization">
          <div className="flex flex-wrap items-center gap-2"><RealTag /><span className="text-xs text-muted-foreground">Source checked {LAST_VERIFIED}</span></div>
          <h2 className="mt-2 text-lg">About {c.runBy}</h2>
          <p className="mt-1">{c.purpose}</p>
          <p className="mt-1 text-sm text-muted-foreground">Supports: {c.exactFor.filter(isDiseaseId).length ? allDiseaseNamesFor(c) : c.conditions.join(", ")}</p>
          <a href={c.officialUrl} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} mt-3`}>Visit support website<span className="sr-only"> (opens in a new tab)</span></a>
        </section>
      )}

      <div role="tablist" aria-label="Circle sections" className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`min-h-11 px-4 ${tab === t.id ? "border-b-2 border-primary font-bold text-primary" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6">
        {tab === "people" && <People c={c} />}
        {tab === "research" && <Research c={c} scope={scope} selected={selected} home={home} edge={edge} pair={pair} />}
        {tab === "next" && <NextStep c={c} scope={scope} pairId={pair?.id} />}
      </div>
    </div>
  );
}

const DEMO_POSTS = [
  { cat: "Everyday coping", text: "We started a simple evening routine with the same three songs. Bedtime feels calmer for all of us." },
  { cat: "A question for the community", text: "How did you explain hospital visits to a younger sibling?" },
];

interface Post { cat: string; challenge: string; tried: string; changed: string; downsides: string; ask: string }

function People({ c }: { c: Community }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const empty: Post = { cat: "My experience", challenge: "", tried: "", changed: "", downsides: "", ask: "" };
  const [f, setF] = useState<Post>(empty);
  const fields: [keyof Post, string][] = [
    ["challenge", "What challenge were you facing?"], ["tried", "What did you try?"], ["changed", "What changed, if anything?"],
    ["downsides", "Were there downsides?"], ["ask", "What would you like to ask your care team?"],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className={card}>
          <h2 className="text-[22px]">Welcome</h2>
          <p className="mt-2">You don't need to share anything to be here. Joining a circle never makes you visible to researchers.</p>
          <p className="mt-3">Established support: <ExternalA href={c.officialUrl}>{c.runBy}</ExternalA></p>
        </section>
        <section>
          <h2 className="text-[22px]">Experiences</h2>
          <ul className="mt-3 space-y-3">
            {posts.map((p, i) => (
              <li key={i} className={card}>
                <p className="text-sm text-muted-foreground">{p.cat} · Personal experience · saved on this device only (demo)</p>
                {fields.filter(([k]) => p[k]).map(([k, l]) => <p key={k} className="mt-1"><strong>{l}</strong> {p[k]}</p>)}
              </li>
            ))}
            {DEMO_POSTS.map((p) => (
              <li key={p.text} className={card}>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{p.cat} · Illustrative example <FictionalTag /></p>
                <p className="mt-1">{p.text}</p>
                <button className="mt-2 text-sm text-primary underline" onClick={() => toast("Report recorded on this device only (demo). There is no live moderation yet.")}>Report</button>
              </li>
            ))}
          </ul>
        </section>
        <form className={`${card} space-y-3`} onSubmit={(e) => { e.preventDefault(); if (!f.challenge.trim()) return; setPosts([f, ...posts]); setF(empty); toast("Saved on this device only (demo). Nothing was sent."); }}>
          <h2 className="text-[22px]">Share with the circle</h2>
          <label className="block">Post type
            <select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} className="mt-1 block min-h-11 w-full rounded-md border border-border bg-surface px-3">
              <option>Everyday coping</option><option>My experience</option><option>A question for the community</option>
            </select>
          </label>
          {fields.map(([k, l]) => (
            <label key={k} className="block">{l}
              <textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} rows={2} className="mt-1 block w-full rounded-md border border-border bg-surface p-2" />
            </label>
          ))}
          <p className="text-sm text-muted-foreground">Shared experiences are personal, not proven remedies. Posts are never analyzed or exported for research.</p>
          <button className={btnPrimary}>Post (demo)</button>
        </form>
      </div>
      <aside className={`${card} h-fit`}>
        <h2 className="text-lg">Community guidelines</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Be kind. Everyone's path is different.</li>
          <li>Share experiences, not medical advice or doses.</li>
          <li>Never post anyone's private health details.</li>
          <li>Check changes with your care team.</li>
        </ul>
      </aside>
    </div>
  );
}

function Research({ c, scope, selected, home, edge, pair }: {
  c: Community; scope: DiseaseId[]; selected: DiseaseId | undefined; home: DiseaseId | undefined;
  edge: ReturnType<typeof edgeBetween>; pair: (typeof pairs)[number] | undefined;
}) {
  const studies = STUDIES.filter((s) => s.diseases.some((d) => scope.includes(d)));
  const people = CLUSTER_RESEARCHERS.filter((r) => r.diseases.some((d) => scope.includes(d)));
  const assets = useMemo(() => {
    const ids = pair ? [pair.id] : pairs.filter((p) => scope.length === 1 && [p.a, p.b].includes(ATLAS_ID[scope[0]!])).map((p) => p.id);
    const seen = new Set<string>();
    return ids.flatMap((id) => getSharedResearchAssets(id)).filter((a) => !seen.has(a.id) && seen.add(a.id));
  }, [pair, scope]);
  const name = (id?: DiseaseId) => (id ? diseaseById(id)!.name : "");
  const genes = (id?: DiseaseId) => (id ? diseaseById(id)!.genes.join(", ") : "");
  const isShared = c.connectionType === "shared_challenge" || c.connectionType === "undiagnosed";

  return (
    <div className="space-y-8">
      {selected && home && selected !== home && (() => {
        const conn = biologyConnections(selected).find((x) => x.other === home);
        return (
          <section className={card}>
            <h2 className="text-[22px]">Why are we connected?</h2>
            {conn && conn.kind === "specific" ? (
              <>
                <p className="mt-2"><strong>{name(selected)} ↔ {name(home)}</strong> · <span className={conn.status === "Documented" ? "text-evidence-documented" : "text-evidence-inferred"}>{conn.status}</span></p>
                <p className="mt-2"><strong>Shared mechanism: </strong>{conn.mechanism}</p>
                <p className="mt-2 text-sm"><strong>Important differences: </strong>{conn.differences}</p>
                <p className="mt-1 text-sm"><strong>What this does not establish: </strong>{conn.notEstablished}</p>
                <p className="mt-1 flex flex-wrap gap-x-2 text-sm">Sources: {conn.sources.map((s, i) => <ExternalA key={s.url} href={s.url}>[{i + 1}] {s.title}</ExternalA>)}</p>
              </>
            ) : (
              <p className="mt-2">{conn ? conn.notEstablished : "No documented connection in our current sources."} This organization is listed for {name(home)}, not because of a specific biological link.</p>
            )}
            {pair ? (
              <Link to="/map/pair/$pairId" params={{ pairId: pair.id }} search={{ focus: ATLAS_ID[selected] }} className={`${btnSecondary} mt-4`}>View connection in Atlas</Link>
            ) : (
              <>
                <Link to="/map" search={{ focus: ATLAS_ID[selected] }} className={`${btnSecondary} mt-4`}>View on the disease map</Link>
                <p className="mt-2 text-sm text-muted-foreground">This pair has no detailed Atlas comparison yet.</p>
              </>
            )}
          </section>
        );
      })()}
      {isShared && (
        <p className="rounded-lg bg-tint-light p-4">Sharing a daily challenge supports peer connection. It does not mean a shared cause, treatment, or study eligibility, and members may have many different diagnoses.</p>
      )}

      <section>
        <h2 className="text-[22px]">Research studies and registries</h2>
        {studies.length === 0 ? <p className="mt-2 text-muted-foreground">No studies found in the sources we checked.</p> : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {studies.map((s) => (
              <li key={s.id} className={card}>
                <p className="text-sm text-muted-foreground">{s.type} · Research study, not a treatment recommendation</p>
                <h3 className="mt-1 text-lg">{s.title}</h3>
                <p className="mt-1 text-sm">Why relevant: covers {s.diseases.map((d) => diseaseById(d)!.name).join(", ")}.</p>
                <p className="text-sm">Status: {s.status} (ClinicalTrials.gov; source checked {LAST_VERIFIED}). Eligibility: Not confirmed.</p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-primary underline">Ask about participation</summary>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Recipient:</strong> the official study contact on ClinicalTrials.gov.</p>
                    <p><strong>Purpose:</strong> asking whether the study could be right for you.</p>
                    <p><strong>Shared by Rarely Alone:</strong> nothing. You contact the study yourself and choose what to say.</p>
                    <p>Asking is not enrollment, and this does not mean you qualify.</p>
                    <ExternalA href={s.url}>Open official study contact</ExternalA>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[22px]">Researchers</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {people.map((r) => (
            <li key={r.id} className={card}>
              <h3 className="text-lg">{r.name}</h3>
              <p className="text-sm text-muted-foreground">{r.institution}</p>
              <p className="mt-1 text-sm">{r.focus}</p>
              <p className="mt-1 text-sm">Supporting record: <ExternalA href={r.profileUrl}>{r.profileLabel}</ExternalA></p>
              <p className="mt-1 text-xs text-muted-foreground">Listed for published relevance. This does not imply willingness to collaborate.</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[22px]">Existing research assets</h2>
        {assets.length === 0 ? <p className="mt-2 text-muted-foreground">No shared research asset is documented in the Atlas for this circle.</p> : (
          <ul className="mt-3 space-y-3">
            {assets.map((a) => (
              <li key={a.id} className={card}>
                <h3 className="text-lg">{a.label}</h3>
                <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                  <div><dt className="font-bold">What exists</dt><dd>{a.description}</dd></div>
                  <div><dt className="font-bold">What might be reusable</dt><dd>{a.whyRelevant}</dd></div>
                  <div><dt className="font-bold">What differs</dt><dd>Each disease has its own gene and course; results may not transfer.</dd></div>
                  <div><dt className="font-bold">What needs expert review</dt><dd>Disease-specific validation before any reuse.</dd></div>
                </dl>
                <p className="mt-2 text-sm">Sources: {a.sourceUrls.slice(0, 3).map((u, i) => <span key={u}>{i > 0 && ", "}<ExternalA href={u}>[{i + 1}]</ExternalA></span>)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NextStep({ c, scope, pairId }: { c: Community; scope: DiseaseId[]; pairId: string | undefined }) {
  const studies = STUDIES.filter((s) => s.diseases.some((d) => scope.includes(d)));
  const people = CLUSTER_RESEARCHERS.filter((r) => r.diseases.some((d) => scope.includes(d)));
  const assets = useMemo(() => (pairId ? getSharedResearchAssets(pairId) : []), [pairId]);
  const [q, setQ] = useState("");
  const [work, setWork] = useState<string[]>([]);
  const [asset, setAsset] = useState("");
  const [collab, setCollab] = useState("");
  const [unc, setUnc] = useState("");
  const [brief, setBrief] = useState("");
  const [prio, setPrio] = useState("");
  const [prios, setPrios] = useState<string[]>([]);
  const names = scope.map((d) => DISEASES.find((x) => x.id === d)!.name).join(" and ");

  const draft = () => {
    const w = studies.filter((s) => work.includes(s.id));
    const r = people.find((p) => p.id === collab);
    const a = assets.find((x) => x.id === asset);
    setBrief([
      `Research inquiry from ${c.name}`,
      `Question: ${q || "[your question]"}`,
      `Context: ${names || "this circle"}.`,
      w.length ? `Existing work: ${w.map((s, i) => `${s.title} [${i + 1}]`).join("; ")}.` : "Existing work: none selected.",
      a ? `Possibly reusable asset: ${a.label}.` : "",
      r ? `Asking: ${r.name} (${r.institution}), based on ${r.profileLabel.toLowerCase()} [${w.length + 1}].` : "",
      `Uncertainties and checks: ${unc || "Not yet recorded."}`,
      "",
      "Sources:",
      ...w.map((s, i) => `[${i + 1}] ${s.url}`),
      ...(r ? [`[${w.length + 1}] ${r.profileUrl}`] : []),
    ].filter(Boolean).join("\n"));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className={`${card} space-y-4`}>
        <h2 className="text-[22px]">Prepare a research inquiry</h2>
        <p className="text-sm text-muted-foreground">If a shared study or organization already exists, start from it: ask about an existing registry rather than proposing something new.</p>
        <label className="block">1. Define a research question
          <input value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-border bg-surface px-3" placeholder="e.g. Ask about an existing registry for swallowing outcomes" />
        </label>
        <fieldset><legend>2. Existing work addressing it</legend>
          {studies.map((s) => (
            <label key={s.id} className="mt-1 flex gap-2 text-sm"><input type="checkbox" checked={work.includes(s.id)} onChange={() => setWork(work.includes(s.id) ? work.filter((x) => x !== s.id) : [...work, s.id])} />{s.title}</label>
          ))}
        </fieldset>
        <label className="block">3a. Relevant asset
          <select value={asset} onChange={(e) => setAsset(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-border bg-surface px-3">
            <option value="">{assets.length ? "Choose an asset" : "None documented for this circle"}</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="block">3b. Potential collaborator
          <select value={collab} onChange={(e) => setCollab(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-border bg-surface px-3">
            <option value="">Choose a researcher</option>
            {people.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="block">4. Uncertainties and checks
          <textarea value={unc} onChange={(e) => setUnc(e.target.value)} rows={2} className="mt-1 block w-full rounded-md border border-border bg-surface p-2" />
        </label>
        <button type="button" onClick={draft} className={btnPrimary}>5. Draft the cited brief</button>
        {brief && (
          <>
            <label className="block">Editable brief
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={12} className="mt-1 block w-full rounded-md border border-border bg-surface p-2 font-mono text-sm" />
            </label>
            <button type="button" className={btnSecondary} onClick={() => { void navigator.clipboard?.writeText(brief); toast("Brief copied. Nothing was sent."); }}>Copy brief</button>
          </>
        )}
      </section>
      <aside className={`${card} h-fit`}>
        <h2 className="text-lg">Community priorities</h2>
        <p className="mt-1 text-sm text-muted-foreground">Questions members want research to address. Optional, not clinical evidence. Saved on this device only (demo).</p>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (prio.trim()) { setPrios([...prios, prio.trim()]); setPrio(""); } }}>
          <input aria-label="Suggest a question" value={prio} onChange={(e) => setPrio(e.target.value)} className="min-h-11 flex-1 rounded-md border border-border bg-surface px-3" />
          <button className={btnSecondary}>Add</button>
        </form>
        <ul className="mt-3 list-disc pl-5 text-sm">{prios.map((p) => <li key={p}>{p}</li>)}</ul>
      </aside>
    </div>
  );
}

function allDiseaseNamesFor(c: Community) {
  const org = organizations.find((o) => o.id === c.id);
  const ids = org ? org.diseases : c.exactFor.filter(isDiseaseId);
  return ids.map((d) => diseaseById(d)?.name).filter(Boolean).join(", ");
}
