import { useState } from "react";
import { toast } from "sonner";
import { patterns, type HelpedCategory, type Pattern } from "@/data/community";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChipToggle, btnPrimary, btnSecondary, card } from "./bits";

const MIN_GROUP = 10;
const SCOPES = ["Lysosomal cluster", "Tay-Sachs", "Sandhoff", "NPC", "Gaucher", "SPG11"] as const;
const CATEGORIES: HelpedCategory[] = ["Routines and environment", "Therapies and equipment", "School and daily-life supports", "Other"];
type Role = "All" | "Caregivers" | "Patients";

function view(p: Pattern, scope: (typeof SCOPES)[number], role: Role, cats: HelpedCategory[]) {
  if (role !== "All" && role !== p.role) return null;
  const total = scope === "Lysosomal cluster" ? p.totalCount : (p.countsByCondition.find((c) => c.condition === scope)?.count ?? 0);
  if (total < MIN_GROUP) return null;
  const themes = p.helpedThemes.filter((t) => t.count >= MIN_GROUP && (!cats.length || cats.includes(t.category)));
  if (cats.length && !themes.length) return null;
  return { total, themes, bars: scope === "Lysosomal cluster" ? p.countsByCondition : p.countsByCondition.filter((c) => c.condition === scope) };
}

export function PatternsPanel() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("Lysosomal cluster");
  const [role, setRole] = useState<Role>("All");
  const [cats, setCats] = useState<HelpedCategory[]>([]);
  const [invite, setInvite] = useState<Pattern | null>(null);

  const n = q.trim().toLowerCase();
  const searched = patterns.filter(
    (p) => !n || `${p.challenge} ${p.coOccurring.map((c) => c.label).join(" ")}`.toLowerCase().includes(n),
  );
  const shown = searched.map((p) => ({ p, v: view(p, scope, role, cats) }));
  const hiddenCount = shown.filter((s) => !s.v).length;

  return (
    <section>
      <h2>Patterns from families' shared experiences</h2>
      <p className="mt-1 text-muted-foreground">
        Combined, anonymous patterns from families who chose to share with researchers. Groups smaller than 10 people are hidden so no
        one can be identified. Patient-reported experiences are signals worth studying, not evidence that something works.
      </p>

      <div className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-4">
        <label className="block">
          <span className="sr-only">Search by symptom or challenge</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by symptom or challenge"
            className="min-h-11 w-full rounded-md border border-border px-3"
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="text-sm font-bold">
            Condition or cluster
            <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="mt-1 block min-h-11 rounded-md border border-border bg-surface px-3 text-base font-normal">
              {SCOPES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 block min-h-11 rounded-md border border-border bg-surface px-3 text-base font-normal">
              <option>All</option>
              <option>Caregivers</option>
              <option>Patients</option>
            </select>
          </label>
        </div>
        <ChipToggle label='"What helped" category' options={CATEGORIES} value={cats} onChange={setCats} />
        <p className="text-sm text-muted-foreground">
          Entries mentioning medicines, supplements, or diets are held for moderator review and not summarized.
        </p>
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-muted-foreground">
        Showing {shown.length - hiddenCount} patterns
      </p>
      <div className="mt-2 grid gap-4">
        {shown.map(({ p, v }) =>
          !v ? (
            <div key={p.id} className="rounded-lg border border-dashed border-border bg-surface p-4 text-muted-foreground">
              <span className="font-bold text-foreground">{p.challenge}: </span>
              Not enough people share this combination to show it safely.
            </div>
          ) : (
            <article key={p.id} className={`${card} space-y-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-tint px-3 py-0.5 text-sm font-bold text-foreground">Patient-reported</span>
                <span className="text-sm text-muted-foreground">{p.dateRange}</span>
              </div>
              <div>
                <h3>{p.challenge}</h3>
                <p className="mt-1">
                  Reported by {v.total} {p.role.toLowerCase()}
                  {scope === "Lysosomal cluster" ? ` across ${p.countsByCondition.length} conditions in this cluster.` : ` with ${scope}.`}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold">Counts by condition</p>
                <ul className="mt-2 space-y-1">
                  {v.bars.map((b) => (
                    <li key={b.condition} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                      <span>{b.condition}</span>
                      <span className="h-3 rounded-full bg-tint-light">
                        <span className="block h-3 rounded-full bg-primary" style={{ width: `${(b.count / p.totalCount) * 100}%` }} />
                      </span>
                      <span className="text-right">{b.count < MIN_GROUP ? "<10" : b.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {v.themes.length > 0 && (
                <div>
                  <p className="text-sm font-bold">What helped (reported by {p.helpedReporters} of them)</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {v.themes.map((t) => (
                      <li key={t.theme} className="rounded-full bg-tint-light px-3 py-0.5 text-sm">
                        {t.theme} · {t.count}
                      </li>
                    ))}
                  </ul>
                  {p.downsideNote && <p className="mt-1 text-sm text-muted-foreground">{p.downsideNote}</p>}
                </div>
              )}
              <p className="text-sm">
                <span className="font-bold">Reported alongside: </span>
                {p.coOccurring.map((c) => `${c.label.toLowerCase()} (${c.count})`).join(", ")}
              </p>
              <div className="flex flex-wrap gap-2">
                
                <button type="button" className={btnPrimary} onClick={() => setInvite(p)}>
                  Invite people to a study
                </button>
              </div>
            </article>
          ),
        )}
      </div>

      <InviteDialog pattern={invite} onClose={() => setInvite(null)} />
    </section>
  );
}

function InviteDialog({ pattern, onClose }: { pattern: Pattern | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [involves, setInvolves] = useState("");
  const [route, setRoute] = useState("");
  const [error, setError] = useState(false);

  const close = () => {
    setTitle("");
    setInvolves("");
    setRoute("");
    setError(false);
    onClose();
  };

  return (
    <Dialog open={!!pattern} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-surface">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-primary">Invite people to a study</DialogTitle>
          <DialogDescription>For the pattern: {pattern?.challenge}. Only families who opted in to study contact will see this.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !involves.trim() || !route.trim()) return setError(true);
            toast(
              "Your invitation will be shown only to families who opted in to study contact and match this pattern. They decide whether to reply (simulated).",
            );
            close();
          }}
        >
          {([
            ["Study title", title, setTitle, false],
            ["What's involved", involves, setInvolves, true],
            ["Official contact route", route, setRoute, false],
          ] as const).map(([l, v, setter, multi]) => (
            <label key={l} className="block">
              <span className="text-sm font-bold">{l}</span>
              {multi ? (
                <textarea value={v} rows={3} onChange={(e) => setter(e.target.value)} className="mt-1 w-full rounded-md border border-border p-3" />
              ) : (
                <input value={v} onChange={(e) => setter(e.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-border px-3" />
              )}
            </label>
          ))}
          {error && <p role="alert" className="text-sm text-destructive">Please fill in all three fields.</p>}
          <p className="text-sm text-muted-foreground">
            Families who respond use the consent-first introduction, and replies appear in your Inquiries tab.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={close}>Cancel</button>
            <button type="submit" className={btnPrimary}>Send invitation</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
