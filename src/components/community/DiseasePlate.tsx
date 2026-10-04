import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Disease, IconKey, TreatmentTone } from "@/data/diseases";
import { awarenessDateLabel } from "@/data/diseases";
import { ReportDialog } from "./ReportDialog";

/* Per-disease accent/tint are data-driven brand colors for each plate (from the brief). */

export function DiseaseIcon({ iconKey, color, size = 26 }: { iconKey: IconKey; color: string; size?: number }) {
  const common = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {iconKey === "eye" && (
        <>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" {...common} />
          <circle cx="12" cy="12" r="3.2" {...common} />
          <circle cx="12" cy="12" r="1.4" fill={color} />
        </>
      )}
      {iconKey === "dashed-circles" && (
        <>
          <circle cx="9" cy="12" r="6" {...common} strokeDasharray="2.6 2.2" />
          <circle cx="15" cy="12" r="6" {...common} strokeDasharray="2.6 2.2" />
        </>
      )}
      {iconKey === "droplet" && (
        <>
          <path d="M12 3c3.5 4.4 6 7.7 6 10.8A6 6 0 0 1 6 13.8C6 10.7 8.5 7.4 12 3z" {...common} />
          <circle cx="12" cy="14.5" r="1.7" fill={color} />
        </>
      )}
      {iconKey === "crumpled" && <path d="M4 7l4-3 3 2.5L15 4l5 3.5-1.5 4 2 3.5-4 4.5-3.5-1.5L9 20l-4.5-3.5 1.5-4L3.5 10z" {...common} />}
      {iconKey === "path" && (
        <>
          <path d="M3 20c4 0 5-3 8-5s5-4 6-9" {...common} />
          <circle cx="17.5" cy="5" r="1.8" fill={color} />
        </>
      )}
    </svg>
  );
}

export function IconCircle({ d, size = 44 }: { d: Disease; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: d.tint }}
    >
      <DiseaseIcon iconKey={d.iconKey} color={d.accent} size={Math.round(size * 0.6)} />
    </span>
  );
}

export function InitialsAvatar({ name, initials, accent, size = 44 }: { name: string; initials: string; accent: string; size?: number }) {
  return (
    <span
      role="img"
      aria-label={`Avatar for ${name}`}
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-primary-foreground"
      style={{ width: size, height: size, backgroundColor: accent }}
    >
      <span aria-hidden="true">{initials}</span>
    </span>
  );
}

const TONE: Record<TreatmentTone, string> = {
  approved: "bg-[var(--success-tint)] text-evidence-assets",
  trials: "bg-tint-warm text-foreground",
  none: "border border-muted-foreground text-muted-foreground",
};

export function TreatmentChip({ d }: { d: Disease }) {
  const prefix = d.treatmentStatus.tone === "approved" ? "Approved" : d.treatmentStatus.tone === "trials" ? "Trials" : "No approved therapy";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-bold ${TONE[d.treatmentStatus.tone]}`}>
      <span className="sr-only">Treatment status ({prefix}): </span>
      {d.treatmentStatus.label}
    </span>
  );
}

export function RealInfoBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--success-tint)] px-2.5 py-0.5 text-[12.5px] font-bold text-evidence-assets">
      From public sources
    </span>
  );
}

/** Small chip: icon, name, nickname. */
export function PlateChip({ d, showNickname = true }: { d: Disease; showNickname?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface py-0.5 pl-0.5 pr-3 text-sm">
      <IconCircle d={d} size={26} />
      <span className="min-w-0 truncate">
        <span className="font-bold">{d.name}</span>
        {showNickname && <span className="font-heading italic text-muted-foreground"> · "{d.nickname}"</span>}
      </span>
    </span>
  );
}

export function DiseasePlate({
  d,
  size = "medium",
  selected = false,
  onSelect,
  onChangeDisease,
}: {
  d: Disease;
  size?: "medium" | "large";
  selected?: boolean;
  onSelect?: () => void;
  onChangeDisease?: () => void;
}) {
  const [report, setReport] = useState(false);
  const large = size === "large";
  const face = d.faceOfCommunity;
  const named = d.namedAfter.length
    ? `Named after ${d.namedAfter.map((n) => n.name).join(" and ")}`
    : `Also known as ${d.alsoKnownAs[0] ?? "Not reported"}`;

  const body = (
    <>
      <div className="flex items-start gap-3">
        <IconCircle d={d} size={large ? 52 : 44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {large ? <h2 className="text-[28px] leading-tight md:text-[32px]">{d.name}</h2> : <h3 className="text-xl">{d.name}</h3>}
          </div>
          <span
            className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[12.5px] font-bold text-primary-foreground"
            style={{ backgroundColor: d.accent }}
          >
            {d.category}
          </span>
        </div>
      </div>
      <p className={`font-heading italic ${large ? "text-xl" : "text-lg"}`}>"{d.nickname}"</p>
      <p className="text-sm">{named}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-mono">{d.genes.join(", ")}</span>
        <span className="text-muted-foreground">· {d.awareness.label}, {awarenessDateLabel(d)}</span>
      </p>
      <div>
        <TreatmentChip d={d} />
      </div>
    </>
  );

  const faceRow = (
    <div className="flex items-center gap-3 border-t border-border pt-3">
      <InitialsAvatar name={face.name} initials={face.initials} accent={d.accent} size={large ? 44 : 36} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{face.name}</p>
        <p className="text-[13px] text-muted-foreground">{face.role}</p>
      </div>
      <a
        href={face.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-primary hover:bg-tint-light"
        aria-label={`${face.name}'s public page (opens in a new tab)`}
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );

  if (!large) {
    return (
      <article
        className={`relative flex h-full flex-col gap-2 rounded-2xl border bg-surface p-5 transition-shadow motion-reduce:transition-none ${
          selected ? "border-primary ring-4 ring-accent" : "border-border hover:shadow-md"
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`Choose ${d.name}, nicknamed ${d.nickname}. ${d.treatmentStatus.label}.`}
          className="absolute inset-0 rounded-2xl"
        />
        <div className="pointer-events-none flex flex-col gap-2">{body}</div>
        <div className="relative mt-auto">{faceRow}</div>
      </article>
    );
  }

  return (
    <section aria-label={`${d.name} name plate`} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <RealInfoBadge />
        <span className="text-[12.5px] text-muted-foreground">Source checked: {d.lastVerified}</span>
        {onChangeDisease && (
          <button type="button" onClick={onChangeDisease} className="ml-auto text-sm font-bold text-primary underline">
            Change disease
          </button>
        )}
      </div>
      {body}
      {faceRow}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Sources</summary>
        <ul className="mt-2 space-y-1">
          {d.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                {s.title} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setReport(true)} className="mt-2 text-muted-foreground underline">
          Report an error
        </button>
      </details>
      <ReportDialog open={report} onOpenChange={setReport} />
    </section>
  );
}
