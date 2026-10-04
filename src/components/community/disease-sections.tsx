import { Bell, BellRing } from "lucide-react";
import { awarenessDateLabel, nextOccurrence, type Disease } from "@/data/diseases";
import { useCommunity } from "@/lib/community-store";
import { useExperience } from "@/lib/experience";
import { ExternalA, btnSecondary } from "./bits";
import { InitialsAvatar, PlateChip } from "./DiseasePlate";

export function VoiceCard({ d }: { d: Disease }) {
  const f = d.faceOfCommunity;
  return (
    <section className="mt-10" aria-labelledby="voice">
      <h2 id="voice" className="text-[22px]">A voice from this community</h2>
      {d.honestGap && <p className="mt-2 rounded-lg bg-tint-light p-3 text-sm">{d.honestGap}</p>}
      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row">
        <InitialsAvatar name={f.name} initials={f.initials} accent={d.accent} size={64} />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3>{f.name}</h3>
            <p className="text-sm text-muted-foreground">{f.role}</p>
          </div>
          <p>{f.story}</p>
          <ExternalA href={f.link} className="inline-flex items-center gap-1 font-bold text-primary underline">
            Read their story
          </ExternalA>
          <p className="text-sm text-muted-foreground">
            Shared from public sources. We never show photos without permission, and this does not mean they endorse Rarely Alone.
          </p>
        </div>
      </div>
    </section>
  );
}

export function StoryBehindName({ d }: { d: Disease }) {
  const { experience } = useExperience();
  return (
    <details className="mt-10 rounded-2xl border border-border bg-surface p-5" open={experience === "patients"}>
      <summary className="cursor-pointer font-heading text-[22px] text-primary">The story behind the name</summary>
      <div className="mt-4 space-y-4">
        {d.namedAfter.length > 0 ? (
          <div>
            <p className="font-bold">Named after</p>
            <ol className="mt-2 space-y-3 border-l-2 pl-4" style={{ borderColor: d.accent }}>
              {d.namedAfter.map((n) => (
                <li key={n.name}>
                  <span className="font-mono text-sm" style={{ color: d.accent }}>{n.year}</span>
                  <p><strong>{n.name}</strong>: {n.description}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {d.namedAfterNote && <p>{d.namedAfterNote}</p>}
        {d.alsoKnownAs.length > 0 && (
          <p><span className="font-bold">Also known as: </span>{d.alsoKnownAs.join("; ")}</p>
        )}
        <p><span className="font-bold">Why the nickname: </span>{d.nicknameExplanation}</p>
        {d.extraStory && <p>{d.extraStory}</p>}
        {d.hopefulUpdate && (
          <div className="rounded-lg bg-[var(--success-tint)] p-4">
            <p className="font-bold">Hopeful update</p>
            <p className="mt-1">{d.hopefulUpdate}</p>
          </div>
        )}
        {d.treatmentHistory && (
          <div className="rounded-lg bg-tint-warm p-4">
            <p className="font-bold">Treatment history</p>
            <p className="mt-1">{d.treatmentHistory}</p>
            {experience === "research" && d.researchExtra && <p className="mt-2 text-sm">{d.researchExtra}</p>}
          </div>
        )}
      </div>
    </details>
  );
}

export function ReminderToggle({ d }: { d: Disease }) {
  const { reminders, toggleReminder } = useCommunity();
  const on = reminders.includes(d.id);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => toggleReminder(d.id)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-bold ${on ? "border-primary bg-tint text-foreground" : "border-border bg-surface text-foreground"}`}
    >
      {on ? <BellRing className="h-4 w-4 text-primary" aria-hidden="true" /> : <Bell className="h-4 w-4 text-primary" aria-hidden="true" />}
      Remind me
      <span className="sr-only">about {d.awareness.label}</span>
    </button>
  );
}

export function AwarenessCard({ d }: { d: Disease }) {
  return (
    <section className="mt-10" aria-labelledby="awareness">
      <h2 id="awareness" className="text-[22px]">Awareness and events</h2>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <PlateChip d={d} showNickname={false} />
        <p className="font-heading text-xl">{d.awareness.label}</p>
        <p className="font-bold">{awarenessDateLabel(d)}</p>
        <p>{d.awareness.description}</p>
        <div className="flex flex-wrap items-center gap-3">
          <ReminderToggle d={d} />
          <ExternalA href={d.eventsUrl} className={btnSecondary}>Lead organization's events</ExternalA>
        </div>
      </div>
    </section>
  );
}

export function upcomingAwareness(list: Disease[], today = new Date()) {
  return [...list]
    .map((d) => ({ d, next: nextOccurrence(d, today) }))
    .sort((a, b) => a.next.getTime() - b.next.getTime());
}
