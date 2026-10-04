import { useState, type ReactNode } from "react";
import { Bookmark, BookmarkCheck, ChevronDown, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  CONDITIONS,
  CONNECTION_LABELS,
  WHY_TAG_EXPLAINERS,
  type ConditionId,
  type ConnectionType,
  type WhyTag,
} from "@/data/community";
import { useCommunity, type SavedItem } from "@/lib/community-store";
import { diseaseById } from "@/data/diseases";
import { PlateChip } from "./DiseasePlate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary/90";
export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary bg-surface px-4 py-2 font-bold text-primary hover:bg-tint-light";
export const card = "rounded-lg border border-border bg-surface p-5";

const BADGE_STYLES: Record<ConnectionType, string> = {
  exact: "bg-accent text-accent-foreground",
  related_biology: "bg-tint text-foreground",
  shared_challenge: "bg-tint-warm text-foreground border border-border",
  undiagnosed: "bg-tint-light text-foreground",
};

export function ConnectionBadge({ type }: { type: ConnectionType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-bold ${BADGE_STYLES[type]}`}>
      {CONNECTION_LABELS[type]}
    </span>
  );
}

export function FictionalTag() {
  return (
    <span className="inline-flex items-center px-1 text-[12.5px] text-muted-foreground">
      Fictional example
    </span>
  );
}

export function RealTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--success-tint)] px-2 py-0.5 text-[12.5px] font-bold text-evidence-assets">
      From public sources
    </span>
  );
}

export function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[12.5px] text-muted-foreground">
      {source}
    </span>
  );
}

export function BridgeBadge() {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center rounded-full bg-primary px-3 py-0.5 text-sm font-bold text-primary-foreground"
          >
            Bridge researcher
          </button>
        </TooltipTrigger>
        <TooltipContent>Works across two communities in your cluster.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function WhyTagChip({ tag }: { tag: WhyTag }) {
  const style =
    tag === "Complementary approach"
      ? "bg-[var(--violet-tint)] text-evidence-mechanisms"
      : "bg-tint-light text-foreground";
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={`rounded-full px-3 py-0.5 text-sm ${style}`}>
            {tag}
          </button>
        </TooltipTrigger>
        <TooltipContent>{WHY_TAG_EXPLAINERS[tag] ?? tag}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SaveButton({ item }: { item: SavedItem }) {
  const { isSaved, toggleSaved } = useCommunity();
  const saved = isSaved(item.id);
  return (
    <button
      type="button"
      onClick={() => toggleSaved(item)}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.name} from Saved` : `Save ${item.name}`}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-primary hover:bg-tint-light"
    >
      {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
    </button>
  );
}

export function ExternalA({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function WhyThisAppears({ text, evidence, label = "See the evidence" }: { text: string; evidence?: string | undefined; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-sm font-bold text-primary"
      >
        Why this appears
        <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <p className="mt-1 text-sm text-foreground">
          {text}{" "}
          {evidence && (
            <Link to="/dashboard" className="text-primary underline">
              {label}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

export function ConditionOptions() {
  return (
    <>
      {CONDITIONS.filter((c) => c.group === "cluster").map((c) => (
        <option key={c.id} value={c.id}>{c.label}</option>
      ))}
      <optgroup label="Fictional examples">
        {CONDITIONS.filter((c) => c.group === "fictional").map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </optgroup>
    </>
  );
}

export function ConditionSelector({ id = "condition-select" }: { id?: string }) {
  const { condition, setCondition } = useCommunity();
  const current = CONDITIONS.find((c) => c.id === condition) ?? CONDITIONS[0]!;
  const d = diseaseById(condition);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <p className="flex flex-wrap items-center gap-2">
        Showing communities for {d ? <PlateChip d={d} /> : <strong>{current.label}</strong>}
      </p>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Change condition
        <select
          id={id}
          value={condition}
          onChange={(e) => setCondition(e.target.value as ConditionId)}
          className="min-h-11 rounded-md border border-border bg-surface px-3 text-base text-foreground"
        >
          <ConditionOptions />
        </select>
      </label>
    </div>
  );
}

export function ChipToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
              className={`min-h-9 rounded-full border px-3 text-sm ${
                on ? "border-primary bg-tint font-bold text-foreground" : "border-border bg-surface text-foreground"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function PromiseBanner() {
  return (
    <p className="mt-12 rounded-lg bg-tint-warm px-5 py-4 text-center text-foreground">
      Support is available without research participation, and research connections happen by choice.
    </p>
  );
}
