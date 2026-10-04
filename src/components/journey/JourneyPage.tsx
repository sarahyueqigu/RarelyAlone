import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Clock, FlaskConical, Stethoscope, Pill, Flag, NotebookPen, Plus, Trash2, MessageCircleHeart, Send, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { askSymptomAssistant, generateVisitChecklist } from "@/lib/journey.functions";

type Kind = "appointment" | "test" | "diagnosis" | "treatment" | "symptom" | "milestone";
interface JourneyEvent { id: string; kind: Kind; title: string; date: string; time?: string; provider?: string; notes?: string }
interface CheckItem { id: string; text: string; done: boolean }
interface ChatMsg { role: "user" | "assistant"; content: string }

const KINDS: Record<Kind, { label: string; Icon: typeof Stethoscope }> = {
  appointment: { label: "Appointment", Icon: Stethoscope },
  test: { label: "Test or scan", Icon: FlaskConical },
  diagnosis: { label: "Diagnosis", Icon: Flag },
  treatment: { label: "Treatment", Icon: Pill },
  symptom: { label: "Symptom note", Icon: NotebookPen },
  milestone: { label: "Milestone", Icon: CalendarDays },
};

const DEFAULT_CHECKLIST = ["Photo ID and insurance card", "Current medications and dosages", "Recent symptom notes or changes", "Questions you want to ask", "Relevant reports, scans, or lab results"];
const uid = () => Math.random().toString(36).slice(2, 10);
const SEED: JourneyEvent[] = [
  { id: "s1", kind: "symptom", title: "First noticed tingling in hands and feet", date: "2023-06-10", notes: "Worse after exercise and in heat." },
  { id: "s2", kind: "appointment", title: "Primary care visit", date: "2023-09-02", provider: "Dr. Lena Park" },
  { id: "s3", kind: "test", title: "Blood and urine tests", date: "2023-10-14", notes: "Referred to genetics." },
  { id: "s4", kind: "diagnosis", title: "Genetic test result reviewed", date: "2024-02-20", provider: "Genetics clinic" },
  { id: "s5", kind: "appointment", title: "Neurology follow-up", date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), time: "10:30", provider: "Dr. Samuel Ortiz" },
];

function usePersisted<T>(key: string, fallback: T) {
  const [v, setV] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setV(JSON.parse(raw) as T); } catch { /* ignore */ }
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready) try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v, ready]);
  return [v, setV] as const;
}

const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtTime = (t?: string) => t ? new Date(`2000-01-01T${t}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
const today = () => new Date().toISOString().slice(0, 10);
const describe = (events: JourneyEvent[]) => [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(-25)
  .map((e) => `${e.date} · ${KINDS[e.kind].label}: ${e.title}${e.provider ? ` (${e.provider})` : ""}${e.notes ? ` — ${e.notes}` : ""}`).join("\n").slice(0, 3800);

export function JourneyPage() {
  const [events, setEvents] = usePersisted<JourneyEvent[]>("ra-journey-events", SEED);
  const [checklist, setChecklist] = usePersisted<CheckItem[]>("ra-journey-checklist", DEFAULT_CHECKLIST.map((text, i) => ({ id: `d${i}`, text, done: i < 2 })));
  const [checkFor, setCheckFor] = usePersisted<string>("ra-journey-checklist-for", "");
  const [adding, setAdding] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [filter, setFilter] = useState<Kind | "all">("all");

  const upcoming = useMemo(() => events.filter((e) => e.kind === "appointment" && e.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0], [events]);
  const byYear = useMemo(() => {
    const list = events.filter((e) => filter === "all" || e.kind === filter).sort((a, b) => b.date.localeCompare(a.date));
    const groups: [string, JourneyEvent[]][] = [];
    for (const e of list) { const y = e.date.slice(0, 4); const g = groups.find((x) => x[0] === y); if (g) g[1].push(e); else groups.push([y, [e]]); }
    return groups;
  }, [events, filter]);

  const genChecklist = useServerFn(generateVisitChecklist);
  const [genBusy, setGenBusy] = useState(false);
  const visitLabel = upcoming ? `${upcoming.title}${upcoming.provider ? ` with ${upcoming.provider}` : ""} on ${fmtDate(upcoming.date)}` : "";
  async function regenerate() {
    if (!upcoming) return;
    setGenBusy(true);
    try {
      const r = await genChecklist({ data: { visit: visitLabel, context: describe(events) } });
      if (r.ok) { setChecklist(r.value.map((text) => ({ id: uid(), text, done: false }))); setCheckFor(upcoming.id); toast.success("Checklist tailored to your visit"); }
      else toast.error(r.message);
    } catch { toast.error("Couldn't reach the assistant. Please try again."); }
    finally { setGenBusy(false); }
  }

  const done = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((done / checklist.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">My Journey</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Your care timeline</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">Keep your appointments, tests, and milestones in one clear story — saved only in this browser.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" />Add an event</Button>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl bg-primary p-6 text-primary-foreground">
          <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-80">Upcoming care</p>
          <h2 className="mt-2 text-2xl text-primary-foreground">Prepare for your next visit</h2>
          {upcoming ? (
            <div className="mt-4 rounded-lg bg-primary-foreground/10 p-4">
              <p className="font-semibold">{upcoming.title}{upcoming.provider ? ` with ${upcoming.provider}` : ""}</p>
              <p className="mt-2 flex flex-wrap gap-4 text-sm opacity-90">
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{fmtDate(upcoming.date)}</span>
                {upcoming.time && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{fmtTime(upcoming.time)}</span>}
              </p>
            </div>
          ) : <p className="mt-4 text-sm opacity-90">No upcoming appointment yet. Add one to get a tailored checklist.</p>}
          <Button variant="secondary" className="mt-5" onClick={() => setChatOpen(true)}><MessageCircleHeart className="mr-1 h-4 w-4" />Open preparation assistant</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl">Your visit checklist</h2>
              <p className="text-sm text-muted-foreground">{done} of {checklist.length} items ready</p>
            </div>
            <span className="text-sm font-semibold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="mt-3 h-2" />
          <ul className="mt-4 space-y-2">
            {checklist.map((c) => (
              <li key={c.id} className="group flex items-start gap-3">
                <Checkbox id={c.id} checked={c.done} onCheckedChange={(v) => setChecklist((l) => l.map((x) => x.id === c.id ? { ...x, done: !!v } : x))} className="mt-0.5" />
                <label htmlFor={c.id} className={`flex-1 text-sm ${c.done ? "text-muted-foreground line-through" : ""}`}>{c.text}</label>
                <button aria-label={`Remove ${c.text}`} className="opacity-0 transition group-hover:opacity-100 focus:opacity-100" onClick={() => setChecklist((l) => l.filter((x) => x.id !== c.id))}><X className="h-4 w-4 text-muted-foreground" /></button>
              </li>
            ))}
          </ul>
          <AddItem onAdd={(text) => setChecklist((l) => [...l, { id: uid(), text, done: false }])} />
          <Button variant="outline" size="sm" className="mt-4 w-full" disabled={!upcoming || genBusy} onClick={regenerate}>
            <RefreshCw className={`mr-1 h-4 w-4 ${genBusy ? "animate-spin" : ""}`} />
            {genBusy ? "Tailoring checklist…" : checkFor && checkFor === upcoming?.id ? "Regenerate for this visit" : "Generate for my next visit"}
          </Button>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-2xl">Timeline</h2>
          <Select value={filter} onValueChange={(v) => setFilter(v as Kind | "all")}>
            <SelectTrigger className="w-44" aria-label="Filter events"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {Object.entries(KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {byYear.length === 0 && <p className="py-10 text-center text-muted-foreground">No events yet. Add your first one to start your story.</p>}
        {byYear.map(([year, list]) => (
          <div key={year} className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{year}</p>
            <ol className="relative ml-5 border-l border-border">
              {list.map((e) => {
                const { Icon, label } = KINDS[e.kind];
                const next = upcoming?.id === e.id;
                return (
                  <li key={e.id} className="relative mb-4 pl-8">
                    <span className={`absolute -left-5 top-4 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background ${next ? "bg-tint-warm text-foreground" : "bg-primary text-primary-foreground"}`}><Icon className="h-4 w-4" /></span>
                    <article className={`group rounded-lg border p-4 ${next ? "border-tint-warm bg-tint-warm/30" : "border-border bg-card"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-primary">{label}{next ? " · Next up" : ""}</p>
                          <h3 className="mt-1 font-sans text-base font-semibold">{e.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{fmtDate(e.date)}{e.time ? ` · ${fmtTime(e.time)}` : ""}{e.provider ? ` · ${e.provider}` : ""}</p>
                          {e.notes && <p className="mt-2 text-sm">{e.notes}</p>}
                        </div>
                        <button aria-label={`Delete ${e.title}`} className="opacity-0 transition group-hover:opacity-100 focus:opacity-100" onClick={() => setEvents((l) => l.filter((x) => x.id !== e.id))}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>

      <AddEventDialog open={adding} onOpenChange={setAdding} onSave={(e) => { setEvents((l) => [...l, e]); toast.success("Added to your timeline"); }} />
      <SymptomAssistant open={chatOpen} onOpenChange={setChatOpen} context={describe(events)}
        onSaveNote={(text) => { setEvents((l) => [...l, { id: uid(), kind: "symptom", title: "Symptom note from assistant", date: today(), notes: text }]); toast.success("Saved as a symptom note on your timeline"); }} />
    </div>
  );
}

function AddItem({ onAdd }: { onAdd: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t.trim()); setT(""); } }}>
      <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="Add your own item" aria-label="Add checklist item" className="h-9" />
      <Button type="submit" size="sm" variant="ghost" aria-label="Add item"><Plus className="h-4 w-4" /></Button>
    </form>
  );
}

function AddEventDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (e: JourneyEvent) => void }) {
  const [kind, setKind] = useState<Kind>("appointment");
  const [title, setTitle] = useState(""); const [date, setDate] = useState(today()); const [time, setTime] = useState("");
  const [provider, setProvider] = useState(""); const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add an event</DialogTitle><DialogDescription>Document a visit, test, result, or anything that matters to your journey.</DialogDescription></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault(); if (!title.trim()) return;
          onSave({ id: uid(), kind, title: title.trim(), date, ...(time ? { time } : {}), ...(provider.trim() ? { provider: provider.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });
          setTitle(""); setTime(""); setProvider(""); setNotes(""); onOpenChange(false);
        }}>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger aria-label="Event type"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened? e.g. Cardiology check-up" aria-label="Title" />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (optional)" />
          </div>
          <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Doctor or clinic (optional)" aria-label="Doctor or clinic" />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes" />
          <Button type="submit" className="w-full">Save to timeline</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SymptomAssistant({ open, onOpenChange, context, onSaveNote }: { open: boolean; onOpenChange: (o: boolean) => void; context: string; onSaveNote: (t: string) => void }) {
  const [msgs, setMsgs] = usePersisted<ChatMsg[]>("ra-journey-chat", []);
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const ask = useServerFn(askSymptomAssistant);
  const taRef = useRef<HTMLTextAreaElement>(null); const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  useEffect(() => { if (open && !busy) setTimeout(() => taRef.current?.focus(), 50); }, [open, busy]);

  async function send(text: string) {
    const t = text.trim(); if (!t || busy) return;
    const next = [...msgs, { role: "user" as const, content: t }];
    setMsgs(next); setInput(""); setBusy(true); setErr("");
    try {
      const r = await ask({ data: { messages: next.slice(-40), context } });
      if (r.ok) setMsgs([...next, { role: "assistant", content: r.value }]); else setErr(r.message);
    } catch { setErr("Couldn't reach the assistant. Please try again."); }
    finally { setBusy(false); }
  }
  const lastReply = [...msgs].reverse().find((m) => m.role === "assistant");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2"><MessageCircleHeart className="h-5 w-5 text-primary" />Symptom assistant</SheetTitle>
          <SheetDescription>Describe how you feel in your own words. I'll help you turn it into a clear note for your care team. I can't diagnose or give treatment advice.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {msgs.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Try starting with:</p>
              {["My legs have been hurting more this month", "Help me describe my fatigue to my neurologist", "I want to explain a new symptom I noticed"].map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted">{s}</button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => m.role === "user"
            ? <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.content}</div>
            : <div key={i} className="max-w-[95%] whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>)}
          {busy && <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p>}
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border p-4">
          {lastReply && !busy && (
            <div className="mb-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onSaveNote(lastReply.content)}><NotebookPen className="mr-1 h-4 w-4" />Save reply to timeline</Button>
              <Button size="sm" variant="ghost" onClick={() => { setMsgs([]); setErr(""); }}>New conversation</Button>
            </div>
          )}
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <Textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Describe what you're feeling…" aria-label="Message"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} className="min-h-0 resize-none" />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
