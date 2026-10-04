import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CONDITIONS } from "@/data/community";
import { useCommunity } from "@/lib/community-store";
import { useExperience } from "@/lib/experience";
import { Link } from "@tanstack/react-router";
import { btnPrimary, btnSecondary } from "./bits";

type Recipient = { id: string; name: string };
type Flows = {
  openIntro: (r: Recipient, trigger?: HTMLElement) => void;
  openBrief: (r: Recipient, trigger?: HTMLElement) => void;
};
const FlowsCtx = createContext<Flows | null>(null);

export function useFlows() {
  const f = useContext(FlowsCtx);
  if (!f) throw new Error("useFlows must be inside FlowsProvider");
  return f;
}

export function FlowsProvider({ children }: { children: ReactNode }) {
  const [intro, setIntro] = useState<Recipient | null>(null);
  const [brief, setBrief] = useState<Recipient | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const restore = () => setTimeout(() => trigger.current?.focus(), 0);

  return (
    <FlowsCtx.Provider
      value={{
        openIntro: (r, t) => {
          trigger.current = t ?? null;
          setIntro(r);
        },
        openBrief: (r, t) => {
          trigger.current = t ?? null;
          setBrief(r);
        },
      }}
    >
      {children}
      {intro && (
        <IntroDialog
          recipient={intro}
          onClose={() => {
            setIntro(null);
            restore();
          }}
        />
      )}
      <BriefDrawer
        recipient={brief}
        onClose={() => {
          setBrief(null);
          restore();
        }}
      />
    </FlowsCtx.Provider>
  );
}

/* ---------------- Consent-first introduction ---------------- */

const STEPS = ["Recipient", "Reason", "Preview", "Approve", "Sent"];
const INTRO_REASONS = [
  "Ask whether related conditions like mine could ever be considered",
  "Ask what participation involves (visits, travel, time)",
  "Ask how to stay informed about results",
];
const PROFILE_NAME = "Ana R.";

function IntroDialog({ recipient, onClose }: { recipient: Recipient; onClose: () => void }) {
  const { condition, addInquiry } = useCommunity();
  const { setExperience } = useExperience();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");
  const conditionLabel = CONDITIONS.find((c) => c.id === condition)?.label ?? "";

  const next = () => {
    if (step === 1 && !reason) return setError("Choose a reason to continue.");
    if (step === 3) {
      if (!approved) return setError("Please confirm you approve this introduction.");
      addInquiry({
        id: `inq-${Date.now()}`,
        fromName: PROFILE_NAME,
        condition: conditionLabel,
        question: reason,
        note,
        recipientId: recipient.id,
        recipientName: recipient.name,
        receivedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        whyItReachedYou: "Your work covers a biologically related condition.",
        status: "new",
      });
    }
    setError("");
    setStep((s) => s + 1);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-surface sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-primary">Ask a question</DialogTitle>
          <DialogDescription>You choose exactly what is shared. Nothing is sent from this prototype.</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-wrap gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full px-3 py-0.5 text-sm ${
                i === step ? "bg-primary font-bold text-primary-foreground" : i < step ? "bg-tint text-foreground" : "bg-tint-light text-muted-foreground"
              }`}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        <div className="min-h-40 space-y-3">
          {step === 0 && (
            <>
              <p>
                You're writing to <strong>{recipient.name}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">Contact route: official contact from the public record.</p>
            </>
          )}
          {step === 1 && (
            <>
              <fieldset>
                <legend className="mb-2 font-bold">What would you like to ask?</legend>
                {INTRO_REASONS.map((r) => (
                  <label key={r} className="flex min-h-11 items-start gap-3 py-1">
                    <input
                      type="radio"
                      name="intro-reason"
                      checked={reason === r}
                      onChange={() => {
                        setReason(r);
                        setError("");
                      }}
                      className="mt-1 h-5 w-5 accent-[var(--primary)]"
                    />
                    {r}
                  </label>
                ))}
              </fieldset>
              <label className="block">
                <span className="text-sm font-bold">Optional short note</span>
                <textarea
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border p-3"
                />
                <span className="text-[12.5px] text-muted-foreground" aria-live="polite">
                  {note.length}/300
                </span>
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <section className="rounded-lg border-2 border-primary p-4" aria-labelledby="share-title">
                <h3 id="share-title">Exactly what will be shared</h3>
                <dl className="mt-2 space-y-1 text-sm">
                  {[
                    ["To", recipient.name],
                    ["From", PROFILE_NAME],
                    ["Condition", conditionLabel],
                    ["Question", reason],
                    ["Note", note || "None"],
                    ["Reply to", "your email, revealed only to this team"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <p className="text-sm text-muted-foreground">
                Not shared: your community memberships, saved items, browsing, or any medical records. Joining a
                community never permits research contact on its own.
              </p>
            </>
          )}
          {step === 3 && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => {
                  setApproved(e.target.checked);
                  setError("");
                }}
                className="mt-1 h-5 w-5 accent-[var(--primary)]"
              />
              I approve sharing exactly the information above with this recipient, once.
            </label>
          )}
          {step === 4 && (
            <div className="rounded-lg bg-[var(--success-tint)] p-4" role="status">
              <p className="flex items-center gap-2 font-bold text-evidence-assets">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Introduction ready (simulated). Nothing was sent.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {step === 4 ? (
            <>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setExperience("research");
                  onClose();
                  navigate({ to: "/community/research", search: { tab: "inquiries" } });
                }}
              >
                See the researcher's view
              </button>
              <button type="button" className={btnPrimary} onClick={onClose}>
                Done
              </button>
            </>
          ) : (
            <>
              {step > 0 && (
                <button type="button" className={btnSecondary} onClick={() => { setError(""); setStep((s) => s - 1); }}>
                  Back
                </button>
              )}
              <button type="button" className={btnPrimary} onClick={next}>
                {step === 3 ? "Approve and prepare" : "Continue"}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Collaboration brief ---------------- */

function defaultBrief(name: string) {
  return `Our research goal: Understand whether lysosomal ganglioside buildup in SPG11 behaves like GM2 buildup in Tay-Sachs and Sandhoff.

The supported connection: In research models, SPG11 loss appears to cause GM2 buildup, a candidate connection still being studied [e14].

A potentially useful asset: GM2 natural history studies publish outcome measures we could align with [e09].

The unresolved question: Whether this is seen in patients, not only in research models.

Proposed collaborator: ${name}, who leads related work in this cluster [e12].

Proposed milestone: A shared outcome-measure checklist within six months.

Our specific request: A 30-minute call to compare registry fields.

Validation steps before joining forces: Confirm the shared mechanism in a second independent source and review consent language with families.`;
}

const CLAIM_WORDS = /\b(appear|appears|share|shares|could|publishes|leads)\b/i;
const MARKER = /\[e\d+\]/;
const EVIDENCE_CHIPS = [
  { id: "e09", label: "e09: GM2 natural history study (NCT02851862)" },
  { id: "e12", label: "e12: leads related work" },
  { id: "e14", label: "e14: candidate connection, research models" },
];

function BriefDrawer({ recipient, onClose }: { recipient: Recipient | null; onClose: () => void }) {
  return (
    <Sheet open={!!recipient} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-surface sm:max-w-xl">
        {recipient && <BriefBody key={recipient.id} name={recipient.name} />}
      </SheetContent>
    </Sheet>
  );
}

function BriefBody({ name }: { name: string }) {
  const [text, setText] = useState(() => defaultBrief(name));
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const bad = text.split("\n").some((l) => CLAIM_WORDS.test(l) && !MARKER.test(l));
    if (bad) {
      setCopied(false);
      return setError("Citation check failed: a claim is missing an evidence ID. Add one like [e14] or remove the claim.");
    }
    setError("");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
  };

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle className="font-heading text-xl text-primary">Collaboration brief to {name}</SheetTitle>
        <SheetDescription>
          <span className="rounded-full bg-tint px-2 py-0.5 text-sm text-foreground">Draft, editable</span>
        </SheetDescription>
      </SheetHeader>
      <label className="block">
        <span className="sr-only">Brief text</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCopied(false);
          }}
          rows={18}
          className="w-full rounded-md border border-border p-3 text-base"
        />
      </label>
      <div>
        <p className="text-sm font-bold">Cited evidence</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {EVIDENCE_CHIPS.map((c) => (
            <span key={c.id} className="rounded-full bg-tint-light px-3 py-0.5 text-sm text-foreground">{c.label}</span>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={copy}>
          {copied ? "Copied" : "Copy brief"}
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            setText(defaultBrief(name));
            setError("");
            setCopied(false);
          }}
        >
          Reset draft
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Brief copied" : ""}
      </p>
      <p className="text-sm text-muted-foreground">
        You review and send this yourself. Drafting a brief doesn't prove a collaboration.
      </p>
    </div>
  );
}
