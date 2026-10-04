import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Backpack,
  Bookmark,
  BookmarkCheck,
  Cloud,
  Compass,
  Heart,
  Info,
  Moon,
  MoreHorizontal,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { NOT_REPORTED, SYMPTOMS, VISIBILITY_OPTIONS, allCommunities, type Challenge, type Community, type ConnectionType } from "@/data/community";
import { diseaseById } from "@/data/diseases";
import { DiseaseIcon, PlateChip } from "./DiseasePlate";
import { SeeEvidence, StrengthTag } from "./relations";
import { useCommunity } from "@/lib/community-store";
import { LogoMark } from "@/components/layout/Logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConnectionBadge, ExternalA, FictionalTag, RealTag, btnPrimary, btnSecondary } from "./bits";
import { PLATFORM_ICON } from "./cards";
import { ReportDialog } from "./ReportDialog";

/* ---------- Section visuals ---------- */

export const SECTION_TINT: Record<ConnectionType, string> = {
  exact: "bg-accent/40",
  related_biology: "bg-tint",
  shared_challenge: "bg-tint-warm",
  undiagnosed: "bg-tint-light",
};

export function SectionIcon({ type, challenge, className = "h-6 w-6" }: { type: ConnectionType; challenge?: string | undefined; className?: string }) {
  if (type === "exact") return <Heart className={`${className} text-primary`} aria-hidden="true" />;
  if (type === "related_biology") return <LogoMark className={className} />;
  if (type === "undiagnosed") return <Compass className={`${className} text-primary`} aria-hidden="true" />;
  const Icon = challenge === "Sleep" ? Moon : challenge === "Feeding" ? Utensils : challenge === "School" ? Backpack : Cloud;
  return <Icon className={`${className} text-primary`} aria-hidden="true" />;
}

/* ---------- Hero constellation ---------- */

const POINTS: [number, number][] = [
  [22, 26], [68, 18], [86, 58], [44, 88], [14, 70], [84, 86], [40, 10],
];

export function HeroConstellation({ count }: { count: number }) {
  const lit = Math.min(count, POINTS.length);
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0" aria-hidden="true">
      {POINTS.map(([x, y]) => (
        <line key={`l${x}${y}`} x1={50} y1={52} x2={x} y2={y} className="stroke-primary" strokeWidth={3} strokeLinecap="round" />
      ))}
      {POINTS.map(([x, y], i) => (
        <circle
          key={`c${x}${y}`}
          cx={x}
          cy={y}
          r={7}
          className={i < lit ? "constellation-light fill-primary" : "fill-primary"}
          style={{ animationDelay: `${300 + i * 350}ms` }}
        />
      ))}
      <circle cx={50} cy={52} r={12} className="fill-accent" />
    </svg>
  );
}

export function useGreeting(name: string) {
  const [g, setG] = useState(`Hello, ${name}.`);
  useEffect(() => {
    const h = new Date().getHours();
    setG(`${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${name}.`);
  }, [name]);
  return g;
}

/* ---------- Family community card ---------- */

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-sm text-foreground">
      {children}
    </span>
  );
}

export function FamilyCommunityCard({
  c,
  showBadge,
  matches,
}: {
  c: Community;
  showBadge: boolean;
  matches: Challenge[];
}) {
  const { isSaved, toggleSaved } = useCommunity();
  const [reportOpen, setReportOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const saved = isSaved(c.id);
  const related = c.connectionType === "related_biology";
  const [whyOpen, setWhyOpen] = useState(false);
  const d = c.diseaseId ? diseaseById(c.diseaseId) : undefined;

  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-surface ${matches.length ? "ring-2 ring-primary" : ""}`}>
      <div
        className={`flex h-16 items-center justify-between px-5 ${d ? "" : SECTION_TINT[c.connectionType]}`}
        style={d ? { backgroundColor: d.tint } : undefined}
      >
        {d ? <DiseaseIcon iconKey={d.iconKey} color={d.accent} size={32} /> : <SectionIcon type={c.connectionType} challenge={c.sharedChallenge} className="h-8 w-8" />}
        <div className="flex items-center gap-2">
          {matches.length > 0 && (
            <span className="rounded-full bg-surface px-2 py-0.5 text-sm font-bold text-primary">Matches: {matches.join(", ")}</span>
          )}
          {c.isReal ? <RealTag /> : <FictionalTag />}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        {showBadge && <ConnectionBadge type={c.connectionType} />}
        {(d || c.edge || c.closest) && (
          <div className="flex flex-wrap items-center gap-2">
            {d && <PlateChip d={d} showNickname={false} />}
            {c.edge && <StrengthTag strength={c.edge.strength} />}
            {c.closest && <span className="rounded-full bg-tint-light px-2.5 py-0.5 text-[13px] font-bold">Closest option</span>}
          </div>
        )}
        <div>
          <div className="flex items-start gap-2">
            <h3 className="min-w-0">{c.name}</h3>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label={`Source for ${c.name}`} className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Source: {c.source}, checked {c.checkedDate}.{c.realNote ? ` ${c.realNote}` : ""}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">Run by {c.runBy}</p>
        </div>
        <p>{c.purpose}</p>
        <ul className="flex flex-wrap gap-2" aria-label="Details">
          {c.platforms.map((p) => {
            const Icon = PLATFORM_ICON[p];
            return (
              <li key={p}>
                <MetaChip>
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {p}
                </MetaChip>
              </li>
            );
          })}
          <li><MetaChip>{c.languages === NOT_REPORTED ? "Language not reported" : c.languages.join(", ")}</MetaChip></li>
          <li><MetaChip>{c.region === NOT_REPORTED ? "Region not reported" : c.region}</MetaChip></li>
          <li>
            <MetaChip>
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              {c.audience === "Both" ? "Patients and caregivers" : c.audience}
            </MetaChip>
          </li>
        </ul>
        {related ? (
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-bold">Why this appears: </span>
              {c.whyThisAppears}
            </p>
            {c.edge?.caveat && <p className="text-sm text-muted-foreground">{c.edge.caveat}</p>}
            {c.edge && <SeeEvidence edge={c.edge} label={c.name} />}
          </div>
        ) : (
          <div>
            <button type="button" aria-expanded={whyOpen} onClick={() => setWhyOpen((o) => !o)} className="text-sm font-bold text-primary">
              Why this appears {whyOpen ? "−" : "+"}
            </button>
            {whyOpen && <p className="mt-1 text-sm">{c.whyThisAppears}</p>}
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <ExternalA href={c.officialUrl} className={btnPrimary}>
            Visit official page
          </ExternalA>
          <button
            type="button"
            aria-pressed={saved}
            onClick={() => toggleSaved({ kind: "community", id: c.id, name: c.name })}
            className={btnSecondary}
          >
            {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
            {saved ? "In my circle" : "Save to my circle"}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`More options for ${c.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-primary hover:bg-tint-light">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-surface">
              <DropdownMenuItem onSelect={() => setAskOpen(true)}>Add a question to bring</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={() => setReportOpen(true)} className="text-sm text-muted-foreground underline">
            Report link
          </button>
        </div>
      </div>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />
      <QuestionDialog open={askOpen} onOpenChange={setAskOpen} community={c} />
    </article>
  );
}

/* ---------- Questions to bring ---------- */

const SUGGESTED = [
  "How do I join, and who moderates the group?",
  "Are there members in my region?",
  "Do you share research updates?",
];

function QuestionDialog({ open, onOpenChange, community }: { open: boolean; onOpenChange: (o: boolean) => void; community: Community }) {
  const { addQuestion } = useCommunity();
  const [picked, setPicked] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    const all = [...picked, ...(own.trim() ? [own.trim()] : [])];
    if (!all.length) return setError(true);
    all.forEach((text, i) =>
      addQuestion({ id: `q-${Date.now()}-${i}`, communityId: community.id, communityName: community.name, text }),
    );
    toast(all.length === 1 ? "Question added to bring." : `${all.length} questions added to bring.`);
    setPicked([]);
    setOwn("");
    setError(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-primary">Add a question to bring</DialogTitle>
          <DialogDescription>For {community.name}. Questions stay on this device.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-bold">Suggested questions</legend>
          {SUGGESTED.map((q) => (
            <label key={q} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={picked.includes(q)}
                onChange={(e) => {
                  setError(false);
                  setPicked((p) => (e.target.checked ? [...p, q] : p.filter((x) => x !== q)));
                }}
                className="h-5 w-5 accent-[var(--primary)]"
              />
              {q}
            </label>
          ))}
        </fieldset>
        <label className="block">
          <span className="text-sm font-bold">Your own question</span>
          <input
            value={own}
            maxLength={200}
            onChange={(e) => {
              setOwn(e.target.value);
              setError(false);
            }}
            className="mt-1 min-h-11 w-full rounded-md border border-border px-3"
          />
          <span className="text-[12.5px] text-muted-foreground">{own.length}/200</span>
        </label>
        {error && <p role="alert" className="text-sm text-destructive">Choose or write a question to continue.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={submit}>Add</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- My circle tray ---------- */

export function CircleTray() {
  const { saved, toggleSaved, questions, removeQuestion, experience, setExperience, milestone, dismissMilestone } = useCommunity();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const circle = saved.filter((s) => s.kind === "community");
  const pool = allCommunities();
  const items = circle.map((s) => pool.find((c) => c.id === s.id)).filter(Boolean) as Community[];

  return (
    <>
      {milestone && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-lg"
        >
          <LogoMark className="h-10 w-10 shrink-0 motion-safe:animate-pulse" />
          <p className="flex-1 font-bold">You found your first community.</p>
          <button type="button" aria-label="Dismiss" onClick={dismissMilestone} className="rounded-md p-2 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open my circle, ${circle.length} saved`}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 inline-flex min-h-12 -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground shadow-lg"
      >
        <span className="flex -space-x-2" aria-hidden="true">
          {items.slice(0, 3).map((c) => (
            <span key={c.id} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary ${SECTION_TINT[c.connectionType]}`}>
              <SectionIcon type={c.connectionType} challenge={c.sharedChallenge} className="h-4 w-4" />
            </span>
          ))}
        </span>
        My circle · {circle.length}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl text-primary">My circle</SheetTitle>
            <SheetDescription>Communities you've saved. Only you can see this list.</SheetDescription>
          </SheetHeader>
          <div className="mx-auto mt-4 max-w-3xl space-y-6">
            {items.length === 0 ? (
              <p className="text-muted-foreground">Nothing here yet. Save a group that feels right and it will appear here.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${SECTION_TINT[c.connectionType]}`}>
                      <SectionIcon type={c.connectionType} challenge={c.sharedChallenge} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-bold">{c.name}</p>
                      {c.diseaseId && diseaseById(c.diseaseId) ? <PlateChip d={diseaseById(c.diseaseId)!} showNickname={false} /> : <ConnectionBadge type={c.connectionType} />}
                    </div>
                    <ExternalA href={c.officialUrl} className={btnPrimary}>Visit official page</ExternalA>
                    <button type="button" className={btnSecondary} onClick={() => toggleSaved({ kind: "community", id: c.id, name: c.name })}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <section>
              <h3>Questions to bring</h3>
              {questions.length === 0 ? (
                <p className="mt-1 text-muted-foreground">Use the "..." menu on any card to add a question.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {questions.map((q) => (
                    <li key={q.id} className="flex items-start gap-2">
                      <span className="flex-1">
                        {q.text} <span className="text-sm text-muted-foreground">· {q.communityName}</span>
                      </span>
                      <button type="button" aria-label={`Remove question: ${q.text}`} onClick={() => removeQuestion(q.id)} className="rounded-md p-2 text-muted-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl bg-tint-warm p-4">
              <h3>My shared experience</h3>
              {experience ? (
                <>
                  <p className="mt-1 text-sm">
                    {experience.role} · {experience.condition} · {experience.symptoms.length} symptoms ·{" "}
                    {experience.helpedEntries.length} "what helped" entries
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Symptoms: {VISIBILITY_OPTIONS.find((v) => v.value === experience.visibility.symptoms)?.label}. What helped:{" "}
                    {VISIBILITY_OPTIONS.find((v) => v.value === experience.visibility.helped)?.label}.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {experience.symptoms.map((s) => SYMPTOMS.find((x) => x.code === s.code)?.label).filter(Boolean).join(", ")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link to="/community/share" className={btnSecondary} onClick={() => setOpen(false)}>Edit</Link>
                    <button type="button" className={btnSecondary} onClick={() => setConfirmDelete(true)}>Delete</button>
                  </div>
                </>
              ) : (
                <Link to="/community/share" className="mt-1 inline-block text-primary underline" onClick={() => setOpen(false)}>
                  Share your experience, only if you want to
                </Link>
              )}
            </section>

            <Link to="/journey" className="inline-block text-primary underline" onClick={() => setOpen(false)}>
              See everything in My Journey
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your shared experience?</AlertDialogTitle>
            <AlertDialogDescription>This removes it everywhere it was visible. You can share again anytime.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setExperience(null);
                toast("Your shared experience was deleted.");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
