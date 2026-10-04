import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { useExperience } from "@/lib/experience";
import { useCommunity } from "@/lib/community-store";
import { DISEASES, awarenessDateLabel, diseaseById, isDiseaseId, nextOccurrence, ATLAS_ID, type DiseaseId } from "@/data/diseases";
import type { Community } from "@/data/community";
import {
  SOURCE_CHECKED,
  biologyConnections,
  inquiryDraft,
  organizationsFor,
  researchActionFor,
  researchersFor,
  sharedChallengeCircles,
  studiesFor,
  type BiologyConnection,
  type OrgForDisease,
} from "@/data/circle-connections";
import { ExternalA, FictionalTag, PromiseBanner, btnPrimary, btnSecondary, card } from "@/components/community/bits";
import { ReminderToggle } from "@/components/community/disease-sections";
import { useGreeting } from "@/components/community/family";
import { DatasetDiseaseTables } from "@/components/community/DatasetDiseaseTables";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDiseaseList } from "@/lib/circle-explore.functions";

export const Route = createFileRoute("/community/")({
  head: () =>
    pageHead("Find My Circle", "Find support for your diagnosis, people facing similar daily challenges, and research connections you can explore by choice."),
  component: CommunityHub,
});

const sourceNote = `From public sources · source checked ${SOURCE_CHECKED} · not affiliated with Rarely Alone`;

function CommunityHub() {
  const { experience } = useExperience();
  const { condition, setCondition } = useCommunity();
  const greeting = useGreeting("Ana");
  const patient = experience === "patients";
  const [other, setOther] = useState<string | null>(null);
  const d: DiseaseId | undefined = !other && isDiseaseId(condition) ? condition : undefined;
  const undiagnosed = !other && condition === "undiagnosed";

  return (
    <div>
      <section className="rounded-3xl bg-tint-warm p-6 md:p-8">
        <p className="text-muted-foreground">{greeting}</p>
        <h1 className="mt-1">Find your circle.</h1>
        <p className="mt-2 max-w-2xl text-lg">
          {patient ? "Support for your diagnosis first, then people who share your daily challenges." : "Evidence-backed connections, existing research assets, and possible collaborators."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">No account or medical records needed. Joining a circle never makes you visible to researchers.</p>
      </section>

      <DiseaseSelector value={other ?? condition} onChange={(v) => { setOther(null); setCondition(v); }} onOther={setOther} />

      {other && <DatasetDiseaseTables name={other} />}

      {d && <Counts d={d} />}

      {undiagnosed && (
        <>
          <ChallengeSection />
          <p className="mt-6 rounded-lg bg-tint-light p-4 text-sm">
            This is a place to browse support, not a diagnostic tool. A clinical genetics team can advise on testing.
          </p>
        </>
      )}

      {d && patient && (
        <>
          <SameDiagnosis d={d} />
          <ChallengeSection />
          <RelatedBiology d={d} patient />
          <TogetherSection d={d} patient />
          <MyInquiries />
        </>
      )}

      {d && !patient && (
        <>
          <TogetherSection d={d} patient={false} />
          <RelatedBiology d={d} patient={false} />
          <Collaborators d={d} />
          <SameDiagnosis d={d} />
          <ReceivedInquiries />
        </>
      )}

      {!d && !undiagnosed && !other && <p className="mt-8">Choose a disease above to see circles.</p>}

      <section className="mt-12 rounded-3xl bg-tint-warm p-6">
        <h2 className="text-[22px]">Your experience could help others.</h2>
        <p className="mt-2">Share what you live with and what has helped, only if you want to.</p>
        <Link to="/community/share" className={`${btnPrimary} mt-4`}>Share your experience</Link>
      </section>

      <AwarenessDates />
      <PublicStories />
      <PromiseBanner />
    </div>
  );
}

function DiseaseSelector({ value, onChange, onOther }: { value: string; onChange: (v: DiseaseId | "undiagnosed") => void; onOther: (name: string) => void }) {
  const [q, setQ] = useState("");
  const fetchList = useServerFn(getDiseaseList);
  const list = useQuery({ queryKey: ["circle-disease-list"], queryFn: () => fetchList() });
  const n = q.trim().toLowerCase();
  const hit = (...xs: string[]) => !n || xs.some((x) => x.toLowerCase().includes(n));
  const curated = DISEASES.filter((x) => hit(x.name, ...x.genes));
  const others = (list.data ?? []).filter((x) => hit(x.name, ...x.synonyms));
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-left text-sm font-bold ${on ? "bg-primary text-primary-foreground" : "bg-tint-light text-foreground hover:bg-surface"}`;
  return (
    <section className="mt-8" aria-labelledby="choose">
      <h2 id="choose" className="text-[22px]">Find a disease</h2>
      <input type="search" aria-labelledby="choose" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a disease, gene or synonym, e.g. SPG11, Noonan, NF1"
        className="mt-3 h-12 w-full rounded-full border border-border bg-background px-5 outline-none focus:border-primary" />
      <div className="mt-3 max-h-72 space-y-3 overflow-auto">
        {curated.length > 0 && <div><p className="text-xs font-bold uppercase text-muted-foreground">Curated circles</p>
          <ul className="mt-1 flex flex-wrap gap-2">{curated.map((x) => <li key={x.id}><button type="button" aria-pressed={value === x.id} onClick={() => onChange(x.id)} className={chip(value === x.id)}>{x.name} <span className="font-mono text-xs opacity-70">{x.genes.join(", ")}</span></button></li>)}</ul></div>}
        {others.length > 0 && <div><p className="text-xs font-bold uppercase text-muted-foreground">All rare diseases in the dataset</p>
          <ul className="mt-1 flex flex-wrap gap-2">{others.map((x) => <li key={x.name}><button type="button" aria-pressed={value === x.name} onClick={() => onOther(x.name)} className={chip(value === x.name)}>{x.name}{x.ongoingTrials ? ` · ${x.ongoingTrials} ongoing` : ""}</button></li>)}</ul></div>}
        {hit("still searching for a diagnosis", "undiagnosed") && <button type="button" aria-pressed={value === "undiagnosed"} onClick={() => onChange("undiagnosed")} className={chip(value === "undiagnosed")}>Still searching for a diagnosis</button>}
        {!curated.length && !others.length && !list.isLoading && <p className="text-sm text-muted-foreground">No disease matches “{q}”.</p>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Curated circles show support and biology connections. Other diseases show trials, biology and research funding from the dataset.</p>
    </section>
  );
}

function Counts({ d }: { d: DiseaseId }) {
  const name = diseaseById(d)!.name;
  const orgs = organizationsFor(d).length;
  const res = researchersFor(d).length;
  const st = studiesFor(d).length;
  return (
    <p className="mt-6 text-sm text-muted-foreground">
      For <strong className="text-foreground">{name}</strong> in our sources: {orgs} organization{orgs === 1 ? "" : "s"} · {res} listed researcher{res === 1 ? "" : "s"} · {st} registered stud{st === 1 ? "y" : "ies"}.
    </p>
  );
}

function OrgCard({ o, d }: { o: OrgForDisease; d: DiseaseId }) {
  return (
    <li className={`${card} flex flex-col gap-2`}>
      <span className="w-fit rounded-full bg-tint-light px-3 py-1 text-sm">
        {o.relation === "same_diagnosis" ? "Same diagnosis" : "Broader support organization"}
      </span>
      <h3 className="text-lg">{o.org.name}</h3>
      <p className="text-sm">Supports: {o.org.diseases.map((x) => diseaseById(x)!.name).join(", ")}</p>
      <p className="text-sm text-muted-foreground">{o.org.maintains}</p>
      {o.relation === "broader_support" && (
        <p className="text-sm">Relevant for support. A specific biological connection to {diseaseById(d)!.name} is not established.</p>
      )}
      <p className="text-xs text-muted-foreground">{sourceNote}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <a href={o.org.profileUrl} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
          Visit support website<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <Link to="/community/circle/$circleId" params={{ circleId: o.org.id }} className={btnSecondary}>Open demo circle</Link>
      </div>
    </li>
  );
}

function SameDiagnosis({ d }: { d: DiseaseId }) {
  const orgs = organizationsFor(d);
  const same = orgs.filter((o) => o.relation === "same_diagnosis");
  const broader = orgs.filter((o) => o.relation === "broader_support");
  return (
    <section className="mt-10" aria-labelledby="same-h">
      <h2 id="same-h" className="text-[22px]">Same diagnosis</h2>
      {same.length === 0 ? (
        <p className="mt-2">We haven't found an organization specific to {diseaseById(d)!.name} in our sources.</p>
      ) : (
        <ul className="mt-3 grid gap-4 md:grid-cols-2">{same.map((o) => <OrgCard key={o.org.id} o={o} d={d} />)}</ul>
      )}
      {broader.length > 0 && (
        <>
          <h3 className="mt-6 text-lg">Broader support organizations</h3>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">{broader.map((o) => <OrgCard key={o.org.id} o={o} d={d} />)}</ul>
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Demo circles are discussion spaces simulated in this app. They are not run or endorsed by these organizations.</p>
    </section>
  );
}

function ChallengeCard({ c }: { c: Community }) {
  return (
    <li className={`${card} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-tint-light px-3 py-1">Shared daily challenges</span>
        {c.isReal ? <span className="text-xs text-muted-foreground">Public community · source checked {c.checkedDate}</span> : <FictionalTag />}
      </div>
      <h3 className="text-lg">{c.name}</h3>
      <p className="text-sm">{c.whyThisAppears}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {c.isReal && <a href={c.officialUrl} target="_blank" rel="noopener noreferrer" className={btnSecondary}>Visit support website<span className="sr-only"> (opens in a new tab)</span></a>}
        <Link to="/community/circle/$circleId" params={{ circleId: c.id }} className={btnSecondary}>Open demo circle</Link>
      </div>
    </li>
  );
}

function ChallengeSection() {
  const list = sharedChallengeCircles();
  return (
    <section className="mt-10" aria-labelledby="ch-h">
      <h2 id="ch-h" className="text-[22px]">Shared daily challenges</h2>
      <p className="text-sm text-muted-foreground">Members have many diagnoses. Shared challenges do not mean shared biology, treatment, or study eligibility.</p>
      <ul className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{list.map((c) => <ChallengeCard key={c.id} c={c} />)}</ul>
    </section>
  );
}

function ConnectionCard({ c, d, patient }: { c: BiologyConnection; d: DiseaseId; patient: boolean }) {
  const other = diseaseById(c.other)!;
  return (
    <li className={`${card} space-y-2`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-tint-light px-3 py-1">Related biology</span>
        <span className={c.status === "Documented" ? "font-bold text-evidence-documented" : "font-bold text-evidence-inferred"}>{c.status}</span>
      </div>
      <h3 className="text-lg">{other.name}</h3>
      <p><strong>{patient ? "What they share: " : "Shared mechanism: "}</strong>{c.mechanism}</p>
      <p className="text-sm"><strong>Important differences: </strong>{c.differences}</p>
      <p className="text-sm"><strong>What this does not establish: </strong>{c.notEstablished}</p>
      <p className="flex flex-wrap gap-x-2 text-sm">Sources: {c.sources.map((s, i) => <ExternalA key={s.url} href={s.url}>[{i + 1}] {s.title}</ExternalA>)}</p>
      {c.orgs.length > 0 && (
        <p className="text-sm">
          Support for {other.name}: {c.orgs.map((o, i) => (
            <span key={o.org.id}>{i > 0 && ", "}{o.org.name}{o.alsoSupportsSelected && <span className="text-muted-foreground"> (also supports {diseaseById(d)!.name}; see Same diagnosis)</span>}</span>
          ))}
        </p>
      )}
      <div className="pt-1">
        {c.atlasPairId ? (
          <Link to="/map/pair/$pairId" params={{ pairId: c.atlasPairId }} search={{ focus: ATLAS_ID[d] }} className={btnSecondary}>View connection in Atlas</Link>
        ) : (
          <>
            <Link to="/map" search={{ focus: ATLAS_ID[d] }} className={btnSecondary}>View on the disease map</Link>
            <p className="mt-1 text-xs text-muted-foreground">No detailed Atlas comparison exists for this pair yet.</p>
          </>
        )}
      </div>
    </li>
  );
}

function RelatedBiology({ d, patient }: { d: DiseaseId; patient: boolean }) {
  const all = biologyConnections(d);
  const specific = all.filter((c) => c.kind === "specific");
  const category = all.filter((c) => c.kind === "category");
  return (
    <section className="mt-10" aria-labelledby="bio-h">
      <h2 id="bio-h" className="text-[22px]">Related biology</h2>
      <p className="text-sm text-muted-foreground">
        {patient ? "Optional. Exploring these never signs you up for research." : "Ordered by evidence status. Each links to its Atlas comparison where one exists."}
      </p>
      {specific.length === 0 ? <p className="mt-2">No specific biological connection in our sources.</p> : (
        <ul className="mt-3 grid gap-4 md:grid-cols-2">{specific.map((c) => <ConnectionCard key={c.edge.id} c={c} d={d} patient={patient} />)}</ul>
      )}
      {category.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Broad category overlap only: {category.map((c) => diseaseById(c.other)!.name).join(", ")}. These are also lysosomal storage diseases, but no specific shared mechanism or reusable asset is established in our sources.
        </p>
      )}
    </section>
  );
}

function TogetherSection({ d, patient }: { d: DiseaseId; patient: boolean }) {
  const a = researchActionFor(d);
  const [draft, setDraft] = useState("");
  if (!a) return null;
  return (
    <section className="mt-10 rounded-2xl border-l-4 border-accent bg-surface p-5 md:p-6" aria-labelledby="together-h">
      <h2 id="together-h" className="text-[22px]">What could we do together?</h2>
      <p className="text-sm text-muted-foreground">One existing asset from the Atlas ({a.pairLabel}). {patient && "Optional, and not a treatment recommendation."}</p>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div><dt className="font-bold">Existing asset</dt><dd>{a.asset}</dd></div>
        <div><dt className="font-bold">Why it is relevant</dt><dd>{a.whyRelevant}</dd></div>
        <div><dt className="font-bold">What may be reusable</dt><dd>{a.reusable}</dd></div>
        <div><dt className="font-bold">Unresolved question or limitation</dt><dd>{a.limitation}</dd></div>
        <div>
          <dt className="font-bold">Who to ask</dt>
          <dd>
            {a.collaborator && <>{a.collaborator.name}, {a.collaborator.institution} (<ExternalA href={a.collaborator.profileUrl}>{a.collaborator.profileLabel}</ExternalA>)</>}
            {a.organization && <span className="block">{a.organization.name}</span>}
            <span className="block text-xs text-muted-foreground">Listed for published relevance; this does not imply willingness to collaborate.</span>
          </dd>
        </div>
        <div><dt className="font-bold">Sources</dt><dd className="flex flex-col">{a.sources.map((s, i) => <ExternalA key={s.url} href={s.url}>[{i + 1}] {s.title}</ExternalA>)}</dd></div>
      </dl>
      {!draft ? (
        <button type="button" className={`${btnPrimary} mt-5`} onClick={() => setDraft(inquiryDraft(d, a))}>Prepare a research inquiry</button>
      ) : (
        <div className="mt-5 space-y-2">
          <label className="block text-sm font-bold" htmlFor="inq">Editable inquiry draft</label>
          <textarea id="inq" value={draft} onChange={(e) => setDraft(e.target.value)} rows={12} className="block w-full rounded-md border border-border bg-surface p-3 font-mono text-sm" />
          <p className="text-xs text-muted-foreground">Nothing is sent automatically. Copy it and send it yourself through the recipient's official contact route.</p>
          <button type="button" className={btnSecondary} onClick={() => { void navigator.clipboard?.writeText(draft); toast("Inquiry copied. Nothing was sent."); }}>Copy inquiry</button>
        </div>
      )}
    </section>
  );
}

function Collaborators({ d }: { d: DiseaseId }) {
  const list = researchersFor(d);
  return (
    <section className="mt-10" aria-labelledby="col-h">
      <h2 id="col-h" className="text-[22px]">Collaborators</h2>
      {list.length === 0 ? <p className="mt-2">No researchers listed for this disease in our sources.</p> : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className={card}>
              <h3 className="text-lg">{r.name}</h3>
              <p className="text-sm text-muted-foreground">{r.institution}</p>
              <p className="mt-1 text-sm">{r.focus}</p>
              <p className="mt-1 text-sm">Supporting record: <ExternalA href={r.profileUrl}>{r.profileLabel}</ExternalA></p>
              <p className="mt-1 text-xs text-muted-foreground">Listed for published relevance. This does not imply willingness to collaborate.</p>
            </li>
          ))}
        </ul>
      )}
      <Link to="/community/research" className="mt-3 inline-block text-primary underline">See all researchers and organizations</Link>
    </section>
  );
}

function MyInquiries() {
  const { inquiries, sentIds } = useCommunity();
  const mine = inquiries.filter((i) => sentIds.includes(i.id));
  return (
    <section className={`${card} mt-10`} aria-labelledby="my-inq">
      <h2 id="my-inq" className="text-[22px]">My inquiries</h2>
      {mine.length === 0 ? (
        <p className="mt-2 text-muted-foreground">You haven't asked anyone anything yet. You can ask a researcher a question, only if you want to.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {mine.map((i) => (
            <li key={i.id} className="text-sm"><strong>{i.recipientName}</strong>: {i.question}<span className="block text-muted-foreground">Sent (simulated) · {i.receivedDate}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReceivedInquiries() {
  return (
    <section className={`${card} mt-10`} aria-labelledby="rec-inq">
      <h2 id="rec-inq" className="text-[22px]">Received inquiries</h2>
      <p className="mt-2">In a live version, inquiries appear only to a signed-in, verified organization or researcher account. Switching the view does not grant access to anyone's messages.</p>
      <Link to="/community/research" search={{ tab: "inquiries" }} className="mt-2 inline-block text-primary underline">Open the demo inbox (fictional inquiries)</Link>
    </section>
  );
}

function AwarenessDates() {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const items = today
    ? DISEASES.map((d) => ({ d, next: nextOccurrence(d, today) })).sort((a, b) => a.next.getTime() - b.next.getTime())
    : [];
  return (
    <details className="mt-10 rounded-2xl border border-border bg-surface p-5">
      <summary className="cursor-pointer text-lg font-bold">Awareness dates</summary>
      <ul className="mt-4 space-y-3">
        {items.map(({ d, next }) => {
          const now = today && next.toDateString() === today.toDateString();
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 border-b border-border pb-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{d.awareness.label}</p>
                <p className="text-sm text-muted-foreground">
                  {d.name} · {now ? "Happening now" : `Next: ${awarenessDateLabel(d)}, ${next.getFullYear()}`}
                </p>
              </div>
              <ReminderToggle d={d} />
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function PublicStories() {
  return (
    <details className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <summary className="cursor-pointer text-lg font-bold">Public stories</summary>
      <p className="mt-2 text-sm text-muted-foreground">Published stories by people in these communities. Listed from public sources; they are not affiliated with Rarely Alone.</p>
      <ul className="mt-3 space-y-2 text-sm">
        {DISEASES.map((d) => (
          <li key={d.id}>
            <strong>{d.faceOfCommunity.name}</strong> ({d.name}): {d.faceOfCommunity.role}. <ExternalA href={d.faceOfCommunity.link}>Source</ExternalA>
          </li>
        ))}
      </ul>
    </details>
  );
}
