import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, MessageCircleQuestion, Send } from "lucide-react";
import { askQuestion } from "@/lib/ask.functions";
import { useExperience } from "@/lib/experience";

const EXAMPLES = {
  patients: ["What is SPG11?", "Why are Tay-Sachs and Sandhoff related?", "Are there studies involving Sandhoff disease?"],
  research: ["How is SPG11 connected to Tay-Sachs and Sandhoff?", "What evidence supports that connection?", "What could researchers studying SPG11 and GM2 diseases investigate together?"],
};
const PLACEHOLDER = {
  patients: "Ask about a rare disease, gene, symptom, study, or treatment...",
  research: "Ask about mechanisms, evidence gaps, studies, biomarkers, or research opportunities...",
};

type Result = Awaited<ReturnType<typeof askQuestion>>;
type Msg = { id: number; role: "user"; text: string } | { id: number; role: "assistant"; res: Result };

export function AskRarelyAlone() {
  const ask = useServerFn(askQuestion);
  const { experience } = useExperience();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, loading]);

  const submit = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || loading) return;
    setQ("");
    setMsgs((m) => [...m, { id: nextId.current++, role: "user", text }]);
    setLoading(true);
    let res: Result;
    try {
      const last = [...msgs].reverse().find((m) => m.role === "assistant" && m.res.status !== "error" && m.res.recognized.length);
      const context = last && last.role === "assistant" && last.res.status !== "error" ? last.res.recognized : [];
      res = await ask({ data: { question: text, context: context.slice(0, 6), audience: experience } });
    } catch {
      res = { status: "error", message: "The assistant is unavailable right now. The resources below are still available." };
    }
    setMsgs((m) => [...m, { id: nextId.current++, role: "assistant", res }]);
    setLoading(false);
    input.current?.focus();
  };

  return (
    <section aria-labelledby="ask-title" className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircleQuestion className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="ask-title" className="text-lg">Ask Rarely Alone</h2>
        <span className="rounded-full bg-tint-light px-2 py-0.5 text-xs font-bold text-primary">Answers only from linked sources</span>
      </header>

      <div ref={scroller} aria-live="polite" className="max-h-[380px] min-h-[160px] space-y-3 overflow-y-auto bg-background px-4 py-4">
        {msgs.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ask a question and I'll answer from the curated Atlas evidence, MedlinePlus, ClinicalTrials.gov, Orphanet, PubMed and NIH RePORTER. Try:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES[experience].map((e) => (
                <button key={e} type="button" onClick={() => void submit(e)}
                  className="rounded-full bg-tint-light px-3 py-1 text-sm hover:bg-tint">{e}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-foreground">{m.text}</p>
            </div>
          ) : (
            <AssistantMessage key={m.id} res={m.res} onFollowUp={(f) => void submit(f)} disabled={loading} />
          ),
        )}
        {loading && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2 text-sm text-muted-foreground">
              <span className="inline-block animate-pulse">Looking through trusted sources…</span>
            </p>
          </div>
        )}
      </div>

      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void submit(q); }}>
        <label htmlFor="ask-input" className="sr-only">Ask a question</label>
        <input
          id="ask-input" ref={input} value={q} onChange={(e) => setQ(e.target.value)} maxLength={400}
          placeholder={PLACEHOLDER[experience]}
          className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 outline-none focus:border-primary"
        />
        <button type="submit" disabled={loading || q.trim().length < 3} aria-label="Send question"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
      <p className="px-4 pb-3 text-xs text-muted-foreground">Educational information from linked sources; not a replacement for medical advice from your care team.</p>
    </section>
  );
}

function AssistantMessage({ res, onFollowUp, disabled }: { res: Result; onFollowUp: (f: string) => void; disabled: boolean }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3">
        {res.status === "error" ? (
          <p className="text-sm">{res.message}</p>
        ) : (
          <>
            {res.recognized.length > 0 && <p className="text-xs text-muted-foreground">Recognized as: <span className="font-bold text-foreground">{res.recognized.join(", ")}</span></p>}
            <p className="whitespace-pre-line">{res.answer}</p>
            {res.status === "answered" && (
              <>
                {res.sources.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Sources used">
                    {res.sources.map((s) => (
                      <li key={s.id}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" title={`${s.title} · ${s.sourceName}`}
                          className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-border bg-tint-light px-2.5 py-1 text-xs text-primary hover:bg-tint">
                          <span className="font-bold">{s.id}</span><span className="truncate">{s.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="sr-only">(opens in new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">No linked source supported a direct answer.</p>}
                {res.uncertainty && <p className="text-xs text-muted-foreground"><span className="font-bold">Uncertain: </span>{res.uncertainty}</p>}
                {res.followUpSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {res.followUpSuggestions.map((f) => (
                      <button key={f} type="button" disabled={disabled} onClick={() => onFollowUp(f)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-tint-light disabled:opacity-50">{f}</button>
                    ))}
                  </div>
                )}
              </>
            )}
            {res.failedSources.length > 0 && <p className="text-xs text-muted-foreground">Couldn't reach {res.failedSources.join(", ")}; used the sources that responded.</p>}
          </>
        )}
      </div>
    </div>
  );
}
