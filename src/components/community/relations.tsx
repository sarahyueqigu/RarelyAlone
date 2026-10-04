import { useState } from "react";
import { useExperience } from "@/lib/experience";
import { STRENGTH_LABELS, type Edge, type EdgeStrength } from "@/data/edges";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExternalA } from "./bits";

const STRENGTH_STYLE: Record<EdgeStrength, string> = {
  same_pathway: "bg-tint text-foreground",
  same_neighborhood: "bg-tint-light text-foreground",
  candidate: "bg-tint-warm text-foreground border border-dashed border-evidence-inferred",
};

export function StrengthTag({ strength }: { strength: EdgeStrength }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold ${STRENGTH_STYLE[strength]}`}>
      {STRENGTH_LABELS[strength]}
    </span>
  );
}

function EvidenceRow({ summary, type, title, url }: { summary: string; type: string; title: string; url: string }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <p>{summary}</p>
      <p className="text-sm">
        <span className="text-muted-foreground">Evidence type: </span>
        <span className="rounded-full bg-tint-light px-2 py-0.5 font-bold">{type}</span>
      </p>
      <p className="text-sm">
        <span className="text-muted-foreground">Source: </span>
        {url ? (
          <ExternalA href={url} className="inline-flex items-center gap-1 text-primary underline">
            {title}
          </ExternalA>
        ) : (
          "Not reported"
        )}
      </p>
    </div>
  );
}

export function SeeEvidence({ edge, label }: { edge: Edge; label: string }) {
  const [open, setOpen] = useState(false);
  const { experience } = useExperience();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-primary underline">
        See the evidence
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-surface sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl text-primary">Why {label} appears</SheetTitle>
            <SheetDescription>
              <StrengthTag strength={edge.strength} />
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4 pb-6">
            <EvidenceRow summary={edge.summary} type={edge.evidenceType} title={edge.sourceTitle} url={edge.sourceUrl} />
            {edge.extra && (
              <EvidenceRow summary={edge.extra.summary} type={edge.extra.evidenceType} title={edge.extra.sourceTitle} url={edge.extra.sourceUrl} />
            )}
            {edge.caveat && <p className="rounded-lg bg-tint-warm p-3 text-sm font-bold">{edge.caveat}</p>}
            {edge.researchDetail && experience === "research" && (
              <div className="space-y-2 text-sm">
                <p className="font-bold">Research detail</p>
                <p>{edge.researchDetail.text}</p>
                <p>
                  <span className="mr-2 inline-flex rounded-full border border-dotted border-evidence-contradicted px-2 py-0.5 text-[12.5px] font-bold text-evidence-contradicted">
                    Contradicted
                  </span>
                  {edge.researchDetail.contradicted}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Connections are leads for research and community, never treatment suggestions.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
