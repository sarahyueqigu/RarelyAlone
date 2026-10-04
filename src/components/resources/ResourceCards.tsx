import { ExternalLink, Link2 } from "lucide-react";
import type { EvidenceKind, EvidenceLabel, Resource } from "@/data/resources";

const LABEL_STYLE: Record<EvidenceLabel, string> = {
  "Patient-friendly": "bg-tint-warm text-foreground",
  "Research paper": "bg-tint-light text-primary",
  "Clinical trial": "bg-tint text-foreground",
  "Completed / non-recruiting clinical study": "bg-tint-light text-foreground",
  "Cited in curated Atlas evidence": "bg-tint-light text-evidence-documented",
  Registry: "bg-[var(--success-tint)] text-evidence-assets",
  "Patient organization": "bg-tint-warm text-foreground",
  Experimental: "bg-[var(--violet-tint)] text-evidence-mechanisms",
  "Established evidence": "bg-tint-light text-evidence-documented",
  "Patient-reported": "bg-tint-warm text-evidence-inferred",
  Hypothesis: "bg-[var(--violet-tint)] text-evidence-mechanisms",
};

const KIND_TEXT: Record<EvidenceKind, string> = {
  published: "Published evidence",
  "patient-reported": "Patient-reported information",
  hypothesis: "Hypothesis",
  experimental: "Experimental research",
};
const KIND_BAR: Record<EvidenceKind, string> = {
  published: "bg-evidence-documented",
  "patient-reported": "bg-evidence-inferred",
  hypothesis: "bg-evidence-mechanisms",
  experimental: "bg-evidence-mechanisms",
};

export function Badge({ label }: { label: EvidenceLabel }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LABEL_STYLE[label]}`}>{label}</span>;
}

function Action({ url, children }: { url: string; children: string }) {
  if (!url) return null; // no exact URL: hide rather than substitute a homepage
  const placeholder = url === "#";
  return placeholder ? (
    <span aria-disabled="true" title="Demo record: no real link" className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-bold text-muted-foreground">
      {children} (demo)
    </span>
  ) : (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
      {children} <ExternalLink className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">(opens in new tab)</span>
    </a>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="text-sm">
      <dt className="inline text-muted-foreground">{k}: </dt>
      <dd className="inline">{v}</dd>
    </div>
  );
}

export function ResourceCard({ r }: { r: Resource }) {
  return (
    <article className="relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface p-5 pl-6">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${KIND_BAR[r.kind]}`} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        {r.labels.map((l) => <Badge key={l} label={l} />)}
        {r.demo && <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">Demo record</span>}
        {r.live && <span className="rounded-full border border-primary px-2.5 py-0.5 text-xs font-bold text-primary">Live sourced result</span>}
      </div>
      <div>
        <h3 className="text-lg">{r.title}</h3>
        <p className="text-sm text-muted-foreground">{r.source} · {KIND_TEXT[r.kind]}</p>
      </div>

      {r.category === "education" && (
        <>
          <p className="text-sm text-muted-foreground">Type: {r.type}</p>
          <p>{r.summary}</p>
        </>
      )}
      {r.category === "research" && (
        <>
          <p className="text-sm">{r.authors} · <em>{r.journal}</em>, {r.year}</p>
          <div className="flex flex-wrap gap-1.5">
            {r.tags.map((t) => <span key={t} className="rounded-full bg-tint-light px-2 py-0.5 text-xs">{t}</span>)}
          </div>
          <p>{r.summary}</p>
        </>
      )}
      {r.category === "trials" && (
        <>
          <p className="rounded-md bg-tint-warm px-3 py-2 text-sm font-bold">Research study, not a treatment recommendation.</p>
          <dl className="space-y-1">
            <Row k="Disease" v={r.disease} />
            <Row k="Intervention" v={r.intervention} />
            <Row k="Status" v={r.status} />
            <Row k="Phase" v={r.phase} />
            <Row k="Location" v={r.location} />
          </dl>
          <p className="text-sm">{r.eligibility}</p>
        </>
      )}
      {(r.category === "registries" || r.category === "organizations") && (
        <dl className="space-y-1">
          <Row k="Disease focus" v={r.focus} />
          <Row k="Purpose" v={r.purpose} />
          <Row k="Scope" v={r.scope} />
        </dl>
      )}
      {r.category === "atlas" && (
        <dl className="space-y-1.5">
          <Row k="Resource" v={r.resourceType} />
          <Row k="Why it's relevant" v={r.why} />
          <div className="flex items-start gap-1.5 text-sm">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div><dt className="inline text-muted-foreground">Atlas connection: </dt><dd className="inline font-bold">{r.trigger}</dd></div>
          </div>
          <Row k="Evidence type" v={r.evidenceType} />
        </dl>
      )}

      <div className="mt-auto pt-1">
        <Action url={r.url}>
          {r.category === "research" ? "View evidence" : r.category === "trials" ? (r.live ? "View study" : "View trial") : "Visit source"}
        </Action>
      </div>
    </article>
  );
}

export function EvidenceKey() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Evidence types">
      {(Object.keys(KIND_TEXT) as EvidenceKind[]).map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span className={`h-3 w-1.5 rounded-sm ${KIND_BAR[k]}`} aria-hidden="true" />
          {KIND_TEXT[k]}
        </li>
      ))}
    </ul>
  );
}

