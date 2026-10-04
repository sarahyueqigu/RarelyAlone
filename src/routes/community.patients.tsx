import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { useCommunity } from "@/lib/community-store";
import {
  CHALLENGES,
  CONDITIONS,
  CONNECTION_LABELS,
  NOT_REPORTED,
  communitiesFor,
  type Audience,
  type Challenge,
  type ConditionId,
  type ConnectionType,
  type Language,
  type Platform,
  type Region,
} from "@/data/community";
import { ChipToggle, ConditionOptions, ExternalA, btnPrimary, btnSecondary } from "@/components/community/bits";
import { diseaseById } from "@/data/diseases";
import { DiseasePlate } from "@/components/community/DiseasePlate";
import { AwarenessCard, StoryBehindName, VoiceCard } from "@/components/community/disease-sections";
import { CircleTray, FamilyCommunityCard, HeroConstellation, SectionIcon, useGreeting } from "@/components/community/family";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export const Route = createFileRoute("/community/patients")({
  head: () => pageHead("Patient collaboration", "Communities that understand what you're going through, run by organizations and verified sources."),
  component: PatientsPage,
});

const BASE_ORDER: ConnectionType[] = ["exact", "related_biology", "shared_challenge", "undiagnosed"];
const SECTION_TITLES: Record<ConnectionType, string> = {
  exact: "Exact-disease communities",
  related_biology: "Related biological communities",
  shared_challenge: "Shared everyday challenges",
  undiagnosed: "Undiagnosed and multi-condition communities",
};
const PLATFORMS: Platform[] = ["Website", "Facebook group", "WhatsApp", "Forum", "Newsletter", "Instagram"];
const LANGS: Language[] = ["English", "Spanish", "French", "Portuguese"];
const REGIONS: Region[] = ["Global", "North America", "Europe", "Latin America"];
const AUDIENCES: Audience[] = ["Patients", "Caregivers", "Both"];

function PatientsPage() {
  const { condition, setCondition, challenges, setChallenges, saved, questions, everSaved, hintDismissed, dismissHint } = useCommunity();
  const greeting = useGreeting("Ana");
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [langs, setLangs] = useState<Language[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [sheet, setSheet] = useState(false);
  const conditionLabel = CONDITIONS.find((c) => c.id === condition)?.label ?? "";
  const disease = diseaseById(condition);
  const isSpg = condition === "spg11";

  const all = communitiesFor(condition);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((c) => {
      if (needle && !`${c.name} ${c.purpose} ${c.runBy} ${c.conditions.join(" ")}`.toLowerCase().includes(needle)) return false;
      if (types.length && !types.includes(CONNECTION_LABELS[c.connectionType])) return false;
      if (platforms.length && !c.platforms.some((p) => platforms.includes(p))) return false;
      if (langs.length && (c.languages === NOT_REPORTED || !c.languages.some((l) => langs.includes(l)))) return false;
      if (regions.length && (c.region === NOT_REPORTED || !regions.includes(c.region))) return false;
      if (audiences.length && !audiences.includes(c.audience)) return false;
      return true;
    });
  }, [all, q, types, platforms, langs, regions, audiences]);

  const matchesFor = (tags: Challenge[]) => challenges.filter((ch) => tags.includes(ch));
  const activeFilters = types.length + platforms.length + langs.length + regions.length + audiences.length;
  const mixed = q.trim() !== "" || types.length > 0;
  const undiagnosedFirst = condition === "zedl9" || condition === "undiagnosed" || challenges.includes("Still searching for a diagnosis");
  const order = undiagnosedFirst ? (["undiagnosed", ...BASE_ORDER.filter((t) => t !== "undiagnosed")] as ConnectionType[]) : BASE_ORDER;
  const matchCount = results.filter((c) => matchesFor(c.challengeTags).length > 0).length;
  const noExact = condition !== "undiagnosed" && !all.some((c) => c.connectionType === "exact");
  const savedCommunities = saved.filter((s) => s.kind === "community").length;

  const clear = () => {
    setQ("");
    setTypes([]);
    setPlatforms([]);
    setLangs([]);
    setRegions([]);
    setAudiences([]);
  };

  const steps = [
    { label: "Tell us what's hardest", done: challenges.length > 0 },
    { label: "Save groups that feel right", done: savedCommunities > 0 },
    { label: "Bring your questions", done: questions.length > 0 },
  ];

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="rounded-3xl bg-tint-warm p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground">{greeting}</p>
            <h1 className="mt-1">You're not alone in this.</h1>
            <p className="mt-2 text-lg">Here are communities that understand what you're going through.</p>
            <label className="mt-4 flex flex-wrap items-center gap-2">
              <span>Showing communities for</span>
              <select
                id="patients-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ConditionId)}
                aria-label="Change condition"
                className="min-h-11 rounded-md border border-border bg-surface px-3 font-bold text-foreground"
              >
                <ConditionOptions />
              </select>
              <span className="text-sm text-muted-foreground">· Change</span>
            </label>
          </div>
          <figure className="flex shrink-0 flex-col items-center text-center">
            <HeroConstellation key={`${condition}-${all.length}`} count={all.length} />
            <figcaption className="mt-2 max-w-56 text-sm text-muted-foreground">
              {all.length} communities found for {conditionLabel}
            </figcaption>
          </figure>
        </div>
        {disease && (
          <div className="mt-6">
            <DiseasePlate d={disease} size="large" onChangeDisease={() => document.getElementById("patients-condition")?.focus()} />
          </div>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
          These groups are run by the organizations listed. Rarely Alone doesn't moderate external groups.
        </p>
      </section>

      {/* What's hardest */}
      <section className="mt-8" aria-labelledby="hardest">
        <h2 id="hardest">What's hardest right now?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHALLENGES.map((ch) => {
            const on = challenges.includes(ch);
            return (
              <button
                key={ch}
                type="button"
                aria-pressed={on}
                onClick={() => setChallenges(on ? challenges.filter((x) => x !== ch) : [...challenges, ch])}
                className={`inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 ${
                  on ? "border-primary bg-tint font-bold text-foreground" : "border-border bg-surface text-foreground"
                }`}
              >
                {on && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                {ch}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">This only changes what you see. Nothing is shared.</p>
        {challenges.length > 0 && (
          <p aria-live="polite" className="mt-1 text-sm">
            {matchCount} {matchCount === 1 ? "community matches" : "communities match"} what you picked.
          </p>
        )}
      </section>

      {!everSaved && !hintDismissed && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-3">
          <ol className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${s.done ? "bg-primary text-primary-foreground" : "bg-tint-light text-foreground"}`}>
                  {s.done ? <Check className="h-4 w-4" aria-label="Done" /> : i + 1}
                </span>
                <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
              </li>
            ))}
          </ol>
          <button type="button" aria-label="Dismiss tips" onClick={dismissHint} className="rounded-md p-2 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {challenges.includes("Understanding research") && (
        <div className="mt-6 rounded-2xl bg-tint-light p-5">
          <p className="font-bold">Research can feel like a different language.</p>
          <p className="mt-1">Start from the Dashboard to look up a condition, at your own pace.</p>
          <Link to="/dashboard" className="mt-2 inline-block text-primary underline">Look up a condition</Link>
        </div>
      )}

      {/* Sticky toolbar */}
      <div className="sticky top-[118px] z-30 mt-8 rounded-2xl border border-border bg-surface/95 p-3 backdrop-blur md:top-[102px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search communities</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search communities"
              className="min-h-11 w-full rounded-md border border-border px-3"
            />
          </label>
          <button type="button" className={btnSecondary} onClick={() => setSheet(true)}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{activeFilters ? ` · ${activeFilters}` : ""}
          </button>
          <p aria-live="polite" className="col-span-2 text-sm text-muted-foreground sm:ml-auto sm:whitespace-nowrap">
            {results.length} {results.length === 1 ? "community" : "communities"}
            {activeFilters + (q ? 1 : 0) > 0 && (
              <button type="button" onClick={clear} className="ml-3 text-primary underline">Clear</button>
            )}
          </p>
        </div>
      </div>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="font-heading text-primary">Filters</SheetTitle>
            <SheetDescription>Narrow what you see. Nothing is shared.</SheetDescription>
          </SheetHeader>
          <div className="mx-auto mt-4 max-w-3xl space-y-4">
            <ChipToggle label="Connection type" options={BASE_ORDER.map((t) => CONNECTION_LABELS[t])} value={types} onChange={setTypes} />
            <ChipToggle label="Platform" options={PLATFORMS} value={platforms} onChange={setPlatforms} />
            <ChipToggle label="Language" options={LANGS} value={langs} onChange={setLangs} />
            <ChipToggle label="Region" options={REGIONS} value={regions} onChange={setRegions} />
            <ChipToggle label="Audience" options={AUDIENCES} value={audiences} onChange={setAudiences} />
            <div className="flex gap-2 pt-2">
              <button type="button" className={btnSecondary} onClick={clear}>Clear filters</button>
              <button type="button" className={btnPrimary} onClick={() => setSheet(false)}>Show {results.length} results</button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {disease && <VoiceCard d={disease} />}

      {noExact && !isSpg && <NoExactCommunity />}

      {order.map((t) => {
        const group = results
          .filter((c) => c.connectionType === t)
          .map((c) => ({ c, m: matchesFor(c.challengeTags) }))
          .sort((a, b) => b.m.length - a.m.length);
        if (!group.length) return null;
        const prominent = t === "undiagnosed" && undiagnosedFirst;
        const feelingAloneBoost = t === "exact" && challenges.includes("Feeling alone");
        return (
          <section key={t} className={`mt-10 ${prominent || feelingAloneBoost ? "rounded-3xl bg-tint-light/60 p-4 md:p-6" : ""}`} aria-labelledby={`sec-${t}`}>
            <h2 id={`sec-${t}`} className="flex items-center gap-2 text-[22px]">
              <SectionIcon type={t} challenge={t === "shared_challenge" ? "Sleep" : undefined} />
              {t === "exact" && disease ? `Communities for ${disease.name}` : SECTION_TITLES[t]}
              <span className="font-sans text-base font-normal text-muted-foreground">· {group.length}</span>
            </h2>
            {t === "exact" && isSpg && (
              <p className="mt-2 rounded-lg bg-tint-warm p-3">
                <strong>No SPG11-specific patient community found yet.</strong> These are the closest options: the broader HSP
                community and an association funding SPG11-focused research.
              </p>
            )}
            {t === "related_biology" && disease && (
              <p className="mt-1 text-sm text-muted-foreground">
                In this cluster, related biology means a shared problem in the lysosome. Some connections are well established; others
                are leads still being studied, and we label which is which.
              </p>
            )}
            {t === "undiagnosed" && (
              <p className="mt-1 text-sm text-muted-foreground">
                Peer support and shared experiences. Rarely Alone never suggests or ranks possible diagnoses.
              </p>
            )}
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {group.map(({ c, m }) => (
                <FamilyCommunityCard key={c.id} c={c} showBadge={mixed} matches={m} />
              ))}
            </div>
            {t === "exact" && isSpg && <NoExactCommunity guideOnly />}
          </section>
        );
      })}
      {disease && <StoryBehindName d={disease} />}
      {disease && <AwarenessCard d={disease} />}
      {results.length === 0 && (
        <p className="mt-10 rounded-2xl bg-surface p-6 text-center">
          We haven't found a group that matches yet, but you're not the only one looking.
        </p>
      )}

      <section className="mt-12 rounded-3xl bg-tint-warm p-6">
        <h2 className="text-[22px]">Your experience could help others, and research.</h2>
        <p className="mt-2">Share what you live with and what has helped, only if you want to.</p>
        <Link to="/community/share" className={`${btnPrimary} mt-4`}>Share your experience</Link>
      </section>

      <section className="mt-6 rounded-3xl bg-tint-light p-6">
        <p className="text-lg">Curious about research? Explore researchers and studies, only if and when you want to.</p>
        <Link to="/community/research" className={`${btnSecondary} mt-4`}>Explore research</Link>
      </section>

      <CircleTray />
    </div>
  );
}

function NoExactCommunity({ guideOnly = false }: { guideOnly?: boolean }) {
  return (
    <section className="mt-8 rounded-3xl border border-border bg-tint-warm p-6">
      {!guideOnly && (
        <>
          <h2>{"No exact-disease community found yet."}</h2>
          <p className="mt-2">
            We searched our directory of patient organizations and verified groups. You might be one of the first families with
            this diagnosis to connect.
          </p>
        </>
      )}
      <h3 className={guideOnly ? "" : "mt-6"}>Start the missing community</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-6">
        <li>Connect with a related community first. They may welcome you or help you start.</li>
        <li>
          Reach out to a rare-disease umbrella organization for guidance on starting a group.{" "}
          <span className="inline-flex flex-wrap gap-3">
            <ExternalA href="https://rarediseases.org" className="inline-flex items-center gap-1 text-primary underline">NORD</ExternalA>
            <ExternalA href="https://globalgenes.org" className="inline-flex items-center gap-1 text-primary underline">Global Genes</ExternalA>
            <ExternalA href="https://www.eurordis.org" className="inline-flex items-center gap-1 text-primary underline">EURORDIS</ExternalA>
          </span>
        </li>
        <li>Decide where your group will live and who will moderate it.</li>
        <li>Set simple community rules: privacy, kindness, no medical advice or product promotion.</li>
        <li>Later, consider a registry so researchers can learn from your community.</li>
      </ol>
      <p className="mt-4 text-sm text-muted-foreground">Starting a group is optional. Support is available either way.</p>
    </section>
  );
}
