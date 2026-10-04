import { useState } from "react";
import { Camera, Globe, Mail, MessageCircle, MessagesSquare, Users } from "lucide-react";
import {
  NOT_REPORTED,
  type Community,
  type Organization,
  type Platform,
  type Researcher,
} from "@/data/community";
import { useExperience } from "@/lib/experience";
import { diseaseById } from "@/data/diseases";
import { PlateChip } from "./DiseasePlate";
import {
  BridgeBadge,
  ConnectionBadge,
  ExternalA,
  FictionalTag,
  RealTag,
  SaveButton,
  SourceChip,
  WhyTagChip,
  WhyThisAppears,
  btnPrimary,
  btnSecondary,
  card,
} from "./bits";
import { ReportDialog } from "./ReportDialog";
import { useFlows } from "./flows";

export const PLATFORM_ICON: Record<Platform, typeof Globe> = {
  Website: Globe,
  "Facebook group": Users,
  WhatsApp: MessageCircle,
  Forum: MessagesSquare,
  Newsletter: Mail,
  Instagram: Camera,
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

export function CommunityCard({ c, compact = false }: { c: Community; compact?: boolean }) {
  const [reportOpen, setReportOpen] = useState(false);
  const langs = c.languages === NOT_REPORTED ? NOT_REPORTED : c.languages.join(", ");
  return (
    <article className={`${card} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <ConnectionBadge type={c.connectionType} />
        <FictionalTag />
      </div>
      <div>
        <h3>{c.name}</h3>
        <p className="text-sm text-muted-foreground">Run by {c.runBy}</p>
      </div>
      <p>{c.purpose}</p>
      {!compact && (
        <>
          <dl className="space-y-1">
            <Row label="Conditions supported" value={c.conditions.join(", ")} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <dt className="text-muted-foreground">Platform:</dt>
              {c.platforms.map((p) => {
                const Icon = PLATFORM_ICON[p];
                return (
                  <dd key={p} className="inline-flex items-center gap-1">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {p}
                  </dd>
                );
              })}
            </div>
            <Row label="Language" value={langs} />
            <Row label="Region" value={c.region} />
            <Row label="Audience" value={c.audience} />
          </dl>
          <WhyThisAppears text={c.whyThisAppears} evidence={c.evidenceLink} />
          <p className="text-[12.5px] text-muted-foreground">
            Source: {c.source}, checked {c.checkedDate}
          </p>
        </>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <ExternalA href={c.officialUrl} className={btnPrimary}>
          Visit official page
        </ExternalA>
        <SaveButton item={{ kind: "community", id: c.id, name: c.name }} />
        {!compact && (
          <button type="button" onClick={() => setReportOpen(true)} className="text-sm text-muted-foreground underline">
            Report link
          </button>
        )}
      </div>
      {!compact && <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />}
    </article>
  );
}

function PrimaryAction({ id, name }: { id: string; name: string }) {
  const { experience } = useExperience();
  const { openIntro, openBrief } = useFlows();
  return experience === "patients" ? (
    <button type="button" className={btnPrimary} onClick={(e) => openIntro({ id, name }, e.currentTarget)}>
      Ask a question
    </button>
  ) : (
    <button type="button" className={btnPrimary} onClick={(e) => openBrief({ id, name }, e.currentTarget)}>
      Draft collaboration brief
    </button>
  );
}

export function ResearcherCard({
  r,
  compact = false,
  highlighted = false,
}: {
  r: Researcher;
  compact?: boolean;
  highlighted?: boolean;
}) {
  return (
    <article
      id={`researcher-${r.id}`}
      tabIndex={-1}
      className={`${card} flex scroll-mt-28 flex-col gap-3 transition-shadow motion-reduce:transition-none ${
        highlighted ? "ring-4 ring-accent" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {r.isBridge && <BridgeBadge />}
        {r.isReal ? <RealTag /> : <FictionalTag />}
      </div>
      <div>
        <h3>{r.name}</h3>
        <p className="text-sm text-muted-foreground">
          {[r.role, r.institution].filter(Boolean).join(", ")}
          {r.verifyAffiliation && <span className="ml-2 rounded-full border border-border px-2 text-[12.5px]">Verify current affiliation</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {r.diseases.map((id) => {
          const d = diseaseById(id);
          return d ? <PlateChip key={id} d={d} showNickname={false} /> : null;
        })}
      </div>
      {r.isReal && <p>{r.whyThisAppears}</p>}
      <div className="flex flex-wrap gap-2" aria-label="Why tags">
        {r.whyTags.map((t) => (
          <WhyTagChip key={t} tag={t} />
        ))}
      </div>
      {!compact && r.recentWork.length > 0 && (
        <>
          <div>
            <p className="text-sm font-bold">Recent relevant work</p>
            <ul className="mt-1 space-y-2">
              {r.recentWork.map((w) => (
                <li key={w.title} className="text-sm">
                  <span className="text-foreground">{w.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span className="capitalize">{w.type}</span> · {w.year} <SourceChip source={w.source} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <WhyThisAppears text={r.whyThisAppears} evidence={r.evidenceLink} label="Show evidence" />
        </>
      )}
      {compact && !r.isReal && <p className="text-sm text-muted-foreground">{r.whyThisAppears}</p>}
      {!compact && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <PrimaryAction id={r.id} name={r.name} />
          <ExternalA href={r.profileUrl} className={btnSecondary}>
            {r.profileLabel ?? "View institutional profile"}
          </ExternalA>
          <SaveButton item={{ kind: "researcher", id: r.id, name: r.name }} />
        </div>
      )}
    </article>
  );
}

export function OrganizationCard({ o }: { o: Organization }) {
  return (
    <article className={`${card} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-tint-light px-3 py-0.5 text-sm text-foreground">{o.type}</span>
        {o.isReal ? <RealTag /> : <FictionalTag />}
      </div>
      <h3>{o.name}</h3>
      <dl className="space-y-1">
        <Row label="Maintains or funds" value={o.maintains} />
        <Row label="Conditions covered" value={o.conditions.join(", ")} />
        <Row label="Public contact route" value={o.contactRoute} />
      </dl>
      <WhyThisAppears text={o.whyThisAppears} />
      <p className="text-[12.5px] text-muted-foreground">
        Source: {o.source}, checked {o.checkedDate}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <PrimaryAction id={o.id} name={o.name} />
        <ExternalA href={o.profileUrl} className={btnSecondary}>
          View official profile
        </ExternalA>
        <SaveButton item={{ kind: "organization", id: o.id, name: o.name }} />
      </div>
    </article>
  );
}
