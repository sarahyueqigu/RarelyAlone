import { ExternalLink } from "lucide-react";
import type { ResearchMatch } from "@/lib/rare-dataset.server";
import type { AtlasResearchMatch } from "@/lib/atlas-research";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Renders only fields present in the dataset; missing fields are omitted, never filled in. */
export function ResearchResults({ matches }: { matches: ResearchMatch[] }) {
  return (
    <div className="mt-4 space-y-8">
      {matches.map((m) => {
        const p = m.pubmed;
        return (
          <div key={m.name} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg">{m.name}</h3>
              {p && (
                <p className="text-sm text-muted-foreground">
                  {p.count.toLocaleString()} PubMed articles · {p.reviewCount.toLocaleString()} reviews
                  {p.firstYear && p.latestYear ? ` · ${p.firstYear}–${p.latestYear}` : ""} ·{" "}
                  <a href={p.pubmedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">See all on PubMed</a>
                </p>
              )}
            </div>
            {!p || p.count === 0 || p.recentArticles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No PubMed articles are recorded for this disease.</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {p.recentArticles.map((a) => (
                  <li key={a.pmid} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">
                      {a.title} <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(opens PubMed in new tab)</span>
                    </a>
                    <p className="text-sm text-muted-foreground">
                      {[a.journal, a.pubDate ?? a.year].filter(Boolean).join(" · ")}
                    </p>
                    {a.authors.length > 0 && (
                      <p className="text-sm">{a.authors.slice(0, 4).join(", ")}{a.authorCount > 4 ? ` +${a.authorCount - 4} more` : ""}</p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-1.5 text-xs">
                      {a.publicationTypes.map((t) => <span key={t} className="rounded-full bg-tint-light px-2 py-0.5">{t}</span>)}
                      <span className="rounded-full border border-border px-2 py-0.5">PMID {a.pmid}</span>
                      {a.doi && <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-2 py-0.5 text-primary hover:underline">DOI {a.doi}</a>}
                      {a.pmcid && <a href={`https://pmc.ncbi.nlm.nih.gov/articles/${a.pmcid}/`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-2 py-0.5 text-primary hover:underline">{a.pmcid}</a>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {m.nih && m.nih.projects.length > 0 && (
              <div>
                <p className="text-sm font-bold">
                  NIH-funded projects · {m.nih.ongoingCount} ongoing, {m.nih.pastCount} past ·{" "}
                  <a href={m.nih.reporterUrl} target="_blank" rel="noopener noreferrer" className="font-normal text-primary hover:underline">NIH RePORTER</a>
                </p>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
                  {m.nih.projects.map((pr) => (
                    <li key={pr.coreProjectNum} className="p-3 text-sm">
                      <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pr.title}</a>
                      <p className="text-muted-foreground">
                        {[pr.coreProjectNum, pr.status, pr.institute, pr.organization, pr.fiscalYears.length ? `FY ${pr.fiscalYears.join(", ")}` : null, pr.totalAwardAmount ? money(pr.totalAwardAmount) : null].filter(Boolean).join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Curated Atlas citations; shows only fields stored in the Atlas source object. */
export function AtlasResearchResults({ match }: { match: AtlasResearchMatch }) {
  return (
    <div className="mt-6 space-y-3">
      <h3 className="text-lg">Curated Atlas evidence · {match.names.join(", ")}</h3>
      <p className="text-sm text-muted-foreground">Sources already cited on Atlas disease and comparison pages. Registry-only trial records appear under Clinical Trials.</p>
      <ul className="grid gap-4 md:grid-cols-2">
        {match.records.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">
              {r.title} <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(opens in new tab)</span>
            </a>
            {r.year != null && r.year !== "" && <p className="text-sm text-muted-foreground">{r.year}</p>}
            <div className="mt-auto flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-tint-light px-2 py-0.5">{r.type}</span>
              {r.pmid && <span className="rounded-full border border-border px-2 py-0.5">PMID {r.pmid}</span>}
              {r.doi && <span className="rounded-full border border-border px-2 py-0.5">DOI {r.doi}</span>}
              {r.nct && <span className="rounded-full border border-border px-2 py-0.5">{r.nct}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
