import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { useCommunity } from "@/lib/community-store";
import {
  CONDITIONS,
  SYMPTOMS,
  VISIBILITY_OPTIONS,
  type HelpedEntry,
  type Impact,
  type SharedExperience,
  type Visibility,
} from "@/data/community";
import { btnPrimary, btnSecondary } from "@/components/community/bits";

export const Route = createFileRoute("/community/share")({
  head: () =>
    pageHead("Share your experience", "Privately record what you live with and what has helped, and choose exactly who can see each part."),
  component: SharePage,
});

const STEPS = ["Before you start", "About you", "Symptoms", "What helped", "Who can see this"];
const IMPACTS: Impact[] = ["A little", "A lot", "Most days"];
const AREAS = Array.from(new Set(SYMPTOMS.map((s) => s.area)));
const ADVICE = /\b(mg|doses?|dosage|stop taking|cures?|cured)\b/i;
const UNDIAGNOSED = "Still searching for a diagnosis";

const blankEntry = (): HelpedEntry => ({
  id: `h-${Date.now()}-${Math.round(Math.random() * 1000)}`,
  symptomCode: "",
  tried: "",
  changed: "",
  downsides: "",
  professional: "Prefer not to say",
});

function SharePage() {
  const { condition, experience, setExperience } = useCommunity();
  const defaultCondition = (CONDITIONS.find((c) => c.id === condition)?.label ?? "");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<SharedExperience>(
    () =>
      experience ?? {
        role: "Caregiver",
        condition: defaultCondition,
        symptoms: [],
        other: "",
        helpedEntries: [],
        visibility: { symptoms: "private", helped: "private" },
        openToStudyContact: false,
        createdAt: "",
      },
  );
  const set = (patch: Partial<SharedExperience>) => setDraft((d) => ({ ...d, ...patch }));
  const setEntry = (id: string, patch: Partial<HelpedEntry>) =>
    set({ helpedEntries: draft.helpedEntries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const entryHasAdvice = (e: HelpedEntry) => ADVICE.test(`${e.tried} ${e.changed} ${e.downsides}`);

  const next = () => {
    if (step === 2 && draft.symptoms.length === 0 && !draft.other.trim())
      return setError("Choose at least one symptom or describe something else to continue.");
    if (step === 3) {
      if (draft.helpedEntries.some(entryHasAdvice))
        return setError("Please edit the highlighted entry so it describes your experience rather than dosing or treatment advice.");
      if (draft.helpedEntries.some((e) => !e.symptomCode || !e.tried.trim()))
        return setError("Each entry needs a challenge and what you tried, or remove the entry.");
    }
    setError("");
    setStep((s) => s + 1);
  };

  const save = () => {
    setExperience({
      ...draft,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    });
    setDone(true);
  };

  const label = (code: string) => SYMPTOMS.find((s) => s.code === code)?.label ?? code;

  if (done) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl bg-[var(--success-tint)] p-8" role="status">
          <CheckCircle2 className="h-8 w-8 text-evidence-assets" aria-hidden="true" />
          <h1 className="mt-3">Thank you.</h1>
          <p className="mt-2 text-lg">Your experience is saved (simulated). You can change who sees it anytime.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => { setDone(false); setStep(1); }}>
              Edit my experience
            </button>
            <Link to="/community/patients" className={btnPrimary}>Back to communities</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1>Share your experience</h1>
      <p className="mt-2 text-lg text-muted-foreground">Private by default. You choose who sees each part, and you can change it anytime.</p>

      <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="text-center">
            <span className={`block h-2 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
            <span className={`mt-1 hidden text-sm sm:block ${i === step ? "font-bold text-primary" : "text-muted-foreground"}`}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-muted-foreground sm:hidden">
        Step {step + 1} of 5: {STEPS[step]}
      </p>

      <div className="mt-6 rounded-3xl border border-border bg-surface p-6">
        {step === 0 && (
          <div className="space-y-3">
            <h2>Before you start</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>We'll ask about symptoms, daily challenges, and, if you like, what has helped.</li>
              <li>Everything is private by default. Only you can see it until you choose otherwise.</li>
              <li>You choose who sees each part: just you, your saved communities, or researchers as anonymous combined patterns.</li>
              <li>You can edit or delete it anytime.</li>
              <li>This is not medical advice, and it will never be used to recommend treatments.</li>
            </ul>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <fieldset>
              <legend className="mb-2 font-bold">Who is sharing?</legend>
              <div className="flex gap-3">
                {(["Patient", "Caregiver"] as const).map((r) => (
                  <label key={r} className={`flex min-h-12 flex-1 items-center gap-3 rounded-xl border-2 px-4 ${draft.role === r ? "border-primary bg-tint-light" : "border-border"}`}>
                    <input type="radio" name="role" checked={draft.role === r} onChange={() => set({ role: r })} className="h-5 w-5 accent-[var(--primary)]" />
                    {r}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="font-bold">Condition</span>
              <select
                value={draft.condition}
                onChange={(e) => set({ condition: e.target.value })}
                className="mt-2 block min-h-11 w-full rounded-md border border-border bg-surface px-3"
              >
                {CONDITIONS.map((c) => <option key={c.id}>{c.label}</option>)}
                <option>{UNDIAGNOSED}</option>
              </select>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2>Symptoms and daily challenges</h2>
            {AREAS.map((area) => (
              <fieldset key={area}>
                <legend className="mb-2 font-bold">{area}</legend>
                <div className="flex flex-wrap gap-2">
                  {SYMPTOMS.filter((s) => s.area === area).map((s) => {
                    const on = draft.symptoms.some((x) => x.code === s.code);
                    return (
                      <button
                        key={s.code}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setError("");
                          set({ symptoms: on ? draft.symptoms.filter((x) => x.code !== s.code) : [...draft.symptoms, { code: s.code }] });
                        }}
                        className={`min-h-11 rounded-full border-2 px-4 ${on ? "border-primary bg-tint font-bold" : "border-border bg-surface"}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {draft.symptoms.length > 0 && (
              <div className="space-y-3 rounded-xl bg-tint-light p-4">
                <p className="font-bold">How much does this affect daily life? (optional)</p>
                {draft.symptoms.map((s) => (
                  <fieldset key={s.code} className="flex flex-wrap items-center gap-2">
                    <legend className="mb-1 w-full text-sm">{label(s.code)}</legend>
                    {IMPACTS.map((imp) => (
                      <label key={imp} className={`flex min-h-11 items-center gap-2 rounded-full border px-3 ${s.impact === imp ? "border-primary bg-surface font-bold" : "border-border bg-surface"}`}>
                        <input
                          type="radio"
                          name={`impact-${s.code}`}
                          checked={s.impact === imp}
                          onChange={() => set({ symptoms: draft.symptoms.map((x) => (x.code === s.code ? { ...x, impact: imp } : x)) })}
                          className="sr-only"
                        />
                        {imp}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            )}
            <label className="block">
              <span className="font-bold">Something else</span>
              <input
                value={draft.other}
                maxLength={100}
                onChange={(e) => { setError(""); set({ other: e.target.value }); }}
                className="mt-1 min-h-11 w-full rounded-md border border-border px-3"
              />
              <span className="text-[12.5px] text-muted-foreground">{draft.other.length}/100</span>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2>What has helped (optional)</h2>
            <p className="rounded-xl bg-tint-warm p-4">
              Share experiences, not instructions. Please don't include medicine doses, advice to stop prescribed treatment, product
              promotions, or claims of a cure. Posts that mention medicines, supplements, or diets are reviewed by moderators before
              anyone else sees them.
            </p>
            {draft.helpedEntries.map((e, i) => {
              const advice = entryHasAdvice(e);
              return (
                <fieldset key={e.id} className={`space-y-3 rounded-xl border-2 p-4 ${advice ? "border-evidence-inferred" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <legend className="font-bold">What helped #{i + 1}</legend>
                    <button type="button" aria-label={`Remove entry ${i + 1}`} onClick={() => set({ helpedEntries: draft.helpedEntries.filter((x) => x.id !== e.id) })} className="rounded-md p-2 text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="block">
                    <span className="text-sm font-bold">Which challenge was this for?</span>
                    <select value={e.symptomCode} onChange={(ev) => setEntry(e.id, { symptomCode: ev.target.value })} className="mt-1 block min-h-11 w-full rounded-md border border-border bg-surface px-3">
                      <option value="">Choose a challenge</option>
                      {draft.symptoms.map((s) => <option key={s.code} value={s.code}>{label(s.code)}</option>)}
                    </select>
                  </label>
                  {([
                    ["tried", "What did you try?", 150],
                    ["changed", "What changed, and what didn't?", 200],
                    ["downsides", "Were there downsides?", 150],
                  ] as const).map(([k, l, max]) => (
                    <label key={k} className="block">
                      <span className="text-sm font-bold">{l}</span>
                      <textarea
                        value={e[k]}
                        maxLength={max}
                        rows={2}
                        onChange={(ev) => { setError(""); setEntry(e.id, { [k]: ev.target.value }); }}
                        className="mt-1 w-full rounded-md border border-border p-3"
                      />
                      <span className="text-[12.5px] text-muted-foreground">{e[k].length}/{max}</span>
                    </label>
                  ))}
                  <fieldset>
                    <legend className="text-sm font-bold">Was a care professional involved?</legend>
                    <div className="mt-1 flex flex-wrap gap-4">
                      {(["Yes", "No", "Prefer not to say"] as const).map((o) => (
                        <label key={o} className="flex min-h-11 items-center gap-2">
                          <input type="radio" name={`pro-${e.id}`} checked={e.professional === o} onChange={() => setEntry(e.id, { professional: o })} className="h-5 w-5 accent-[var(--primary)]" />
                          {o}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {advice && (
                    <p role="alert" className="rounded-md bg-tint-warm p-3 text-sm">
                      This looks like it might include dosing or treatment advice. Please describe your experience instead.
                    </p>
                  )}
                </fieldset>
              );
            })}
            <button type="button" className={btnSecondary} onClick={() => set({ helpedEntries: [...draft.helpedEntries, blankEntry()] })}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add what helped
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2>Who can see this</h2>
            {(["symptoms", "helped"] as const).map((part) => (
              <fieldset key={part}>
                <legend className="mb-2 font-bold">{part === "symptoms" ? "Your symptoms and challenges" : "What helped"}</legend>
                <div className="grid gap-2 md:grid-cols-3">
                  {VISIBILITY_OPTIONS.map((v) => {
                    const on = draft.visibility[part] === v.value;
                    return (
                      <label key={v.value} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${on ? "border-primary bg-tint-light" : "border-border"}`}>
                        <input
                          type="radio"
                          name={`vis-${part}`}
                          checked={on}
                          onChange={() => set({ visibility: { ...draft.visibility, [part]: v.value as Visibility } })}
                          className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
                        />
                        <span>
                          <span className="block font-bold">{v.label}</span>
                          <span className="text-sm text-muted-foreground">{v.desc}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={draft.openToStudyContact} onChange={(e) => set({ openToStudyContact: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]" />
              I'm open to being contacted about studies that match my experience. Invitations reach me only through Rarely Alone, and I decide
              whether to reply.
            </label>
            <section className="rounded-xl border-2 border-primary p-4" aria-labelledby="summary-title">
              <h3 id="summary-title">Exactly what will be saved</h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div><dt className="inline text-muted-foreground">Sharing as: </dt><dd className="inline">{draft.role}, {draft.condition}</dd></div>
                <div>
                  <dt className="inline text-muted-foreground">Symptoms: </dt>
                  <dd className="inline">
                    {draft.symptoms.map((s) => `${label(s.code)}${s.impact ? ` (${s.impact})` : ""}`).join(", ") || "None"}
                    {draft.other && `; ${draft.other}`}
                  </dd>
                </div>
                <div><dt className="inline text-muted-foreground">Who sees symptoms: </dt><dd className="inline">{VISIBILITY_OPTIONS.find((v) => v.value === draft.visibility.symptoms)?.label}</dd></div>
                <div><dt className="inline text-muted-foreground">What helped entries: </dt><dd className="inline">{draft.helpedEntries.length}</dd></div>
                <div><dt className="inline text-muted-foreground">Who sees what helped: </dt><dd className="inline">{VISIBILITY_OPTIONS.find((v) => v.value === draft.visibility.helped)?.label}</dd></div>
                <div><dt className="inline text-muted-foreground">Study contact: </dt><dd className="inline">{draft.openToStudyContact ? "Open to invitations through Rarely Alone" : "No"}</dd></div>
              </dl>
            </section>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-8 flex flex-wrap justify-between gap-2">
          {step > 0 ? (
            <button type="button" className={btnSecondary} onClick={() => { setError(""); setStep((s) => s - 1); }}>Back</button>
          ) : (
            <Link to="/community/patients" className={btnSecondary}>Back</Link>
          )}
          {step === 0 && <button type="button" className={btnPrimary} onClick={next}>I understand, continue</button>}
          {step > 0 && step < 4 && <button type="button" className={btnPrimary} onClick={next}>Continue</button>}
          {step === 4 && <button type="button" className={btnPrimary} onClick={save}>Save my experience</button>}
        </div>
      </div>
    </div>
  );
}
