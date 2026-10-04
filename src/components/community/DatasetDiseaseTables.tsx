// Tables for a non-curated disease from the rare-disease dataset: related biology, ongoing trials, research funding.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDiseaseProfile } from "@/lib/circle-explore.functions";
import { nodes } from "@/lib/atlas/graph";
import { ExternalA, card } from "@/components/community/bits";

const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const money = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const th = "border-b border-border px-3 py-2 text-left font-bold";
const td = "border-b border-border px-3 py-2 align-top";
const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</p>;

/** Small count chip kept visually apart from the section title. */
const Count = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground">{children}</span>
);

/** Section whose content can be collapsed from its title bar; counts sit beside the title, not inside it. */
function Section({ id, title, counts, children }: { id: string; title: string; counts?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left text-xl font-bold text-foreground"
        >
          <span aria-hidden className="text-base text-muted-foreground">{open ? "▾" : "▸"}</span>
          <span id={id}>{title}</span>
          <span className="sr-only">{open ? "— collapse this section" : "— expand this section"}</span>
        </button>
        {counts && <span className="flex flex-wrap items-center gap-2">{counts}</span>}
      </div>
      {open && <div id={`${id}-panel`} className="space-y-3">{children}</div>}
    </section>
  );
}

export function DatasetDiseaseTables({ name }: { name: string }) {
  const fetchProfile = useServerFn(getDiseaseProfile);
  const q = useQuery({ queryKey: ["circle-explore", name], queryFn: () => fetchProfile({ data: { name } }) });
  if (q.isLoading) return <p className="mt-8 text-muted-foreground">Loading {name}…</p>;
  if (q.isError || !q.data) return <p className="mt-8 text-muted-foreground">Couldn't load {name} right now.</p>;
  const p = q.data;
  const genes = [p.gene?.symbol, ...p.otherGenes].filter(Boolean) as string[];
  const atlasNodes = nodes.filter((n) => (n.type === "gene" || n.type === "protein") && genes.some((g) => n.label.toUpperCase().split(/[^A-Z0-9]+/).includes(g.toUpperCase())));
  const projects = [...p.projects.ongoing, ...p.projects.past];
  return (
    <div className="mt-8 space-y-10">
      <h2 className="text-2xl">{p.name}</h2>

      <section aria-labelledby="t-bio" className="space-y-3">
        <h3 id="t-bio" className="text-xl">Related biology</h3>
        <div className={`${card} overflow-x-auto p-0`}><table className="w-full text-sm">
          <tbody>
            <tr><th className={th}>Gene</th><td className={td}>{p.gene ? `${p.gene.symbol}${p.gene.name ? ` — ${p.gene.name}` : ""}` : "Not recorded"}</td></tr>
            <tr><th className={th}>Other genes</th><td className={td}>{p.otherGenes.length ? p.otherGenes.join(", ") : "—"}</td></tr>
            <tr><th className={th}>Chromosome location</th><td className={td}>{p.gene?.location ?? "—"}</td></tr>
            <tr><th className={th}>Inheritance</th><td className={td}>{p.gene?.inheritance ?? "—"}</td></tr>
            <tr><th className={th}>Mechanism</th><td className={td}>{p.mechanism ? `${p.mechanism}${p.mechanismBasis ? ` — ${p.mechanismBasis}` : ""}` : "Not recorded"}</td></tr>
            <tr><th className={th}>Curated Atlas map</th><td className={td}>{atlasNodes.length ? atlasNodes.map((n) => n.label).join(", ") : "No genes or proteins shared with the curated Atlas map."}</td></tr>
          </tbody>
        </table></div>
        <p className="text-sm">More biology (pathways, molecules, research models) is gathered live: <Link to="/dashboard" className="font-bold text-primary underline">search “{p.name}” in the Atlas</Link>.</p>
      </section>

      <Section
        id="t-trials"
        title="Current ongoing clinical trials"
        counts={<Count>{p.trials.ongoing.length} ongoing</Count>}
      >
        {p.trials.ongoing.length ? (
          <div className={`${card} overflow-x-auto p-0`}><table className="w-full text-sm">
            <thead><tr><th className={th}>Trial</th><th className={th}>Status</th><th className={th}>Phase</th><th className={th}>Sponsor</th><th className={th}>Participants</th><th className={th}>Completion</th></tr></thead>
            <tbody>{p.trials.ongoing.map((t) => (
              <tr key={t.nctId}>
                <td className={td}><ExternalA href={t.url} className="font-bold text-primary underline">{t.title}</ExternalA><div className="text-xs text-muted-foreground">{t.nctId}</div></td>
                <td className={td}>{label(t.status)}</td>
                <td className={td}>{t.phases.length ? t.phases.join(", ").replace(/PHASE/g, "Phase ") : "—"}</td>
                <td className={td}>{t.sponsor ?? "—"}</td>
                <td className={td}>{t.enrollment ?? "—"}</td>
                <td className={td}>{t.completion ?? "—"}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty>No ongoing clinical trials are recorded for this disease in the dataset.</Empty>}
      </Section>

      <Section
        id="t-fund"
        title="Research funding & initiatives"
        counts={<><Count>{p.projects.ongoing.length} ongoing</Count><Count>{p.projects.past.length} past</Count></>}
      >
        {projects.length ? (
          <div className={`${card} overflow-x-auto p-0`}><table className="w-full text-sm">
            <thead><tr><th className={th}>Project</th><th className={th}>Status</th><th className={th}>Lead researchers</th><th className={th}>Organisation</th><th className={th}>Fiscal years</th><th className={th}>Total award</th></tr></thead>
            <tbody>{projects.map((x) => (
              <tr key={x.id}>
                <td className={td}>{x.url ? <ExternalA href={x.url} className="font-bold text-primary underline">{x.title}</ExternalA> : x.title}<div className="text-xs text-muted-foreground">{x.id} · {x.focus ? "focuses on this disease" : "mentions this disease"}</div></td>
                <td className={td}>{x.status || "—"}</td>
                <td className={td}>{x.pis.join(", ") || "—"}</td>
                <td className={td}>{[x.organization, x.location].filter(Boolean).join(", ") || "—"}</td>
                <td className={td}>{x.years.join(", ") || "—"}</td>
                <td className={td}>{money(x.amount)}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty>No NIH-funded projects are recorded for this disease in the dataset.</Empty>}
      </Section>
    </div>
  );
}
