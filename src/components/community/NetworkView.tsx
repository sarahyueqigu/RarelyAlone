import { researchers } from "@/data/community";
import { DISEASES } from "@/data/diseases";
import { EDGES } from "@/data/edges";

const W = 640, H = 420, CX = 320, CY = 210, R = 140;
const DPOS = Object.fromEntries(
  DISEASES.map((d, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / DISEASES.length;
    return [d.id, { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }];
  }),
) as Record<string, { x: number; y: number }>;

const FIXED: Record<string, { x: number; y: number }> = {
  "florian-eichler": { x: 450, y: 70 },
  "frederic-darios": { x: 200, y: 70 },
  "giovanni-stevanin": { x: 80, y: 215 },
  "forbes-porter": { x: 510, y: 375 },
  "ellen-sidransky": { x: 130, y: 375 },
};

function researcherPos(ids: string[], idx: number, id?: string) {
  if (id && FIXED[id]) return FIXED[id]!;
  const pts = ids.map((id) => DPOS[id]!).filter(Boolean);
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const dx = mx - CX, dy = my - CY, len = Math.hypot(dx, dy) || 1;
  const push = pts.length > 1 ? 60 : 70;
  return { x: mx + (dx / len) * push + (idx % 2 ? 14 : -14), y: my + (dy / len) * push };
}

const TRIAL = { x: CX + 95, y: CY + 20, diseases: ["npc", "tay-sachs", "sandhoff"] };

export function NetworkView({ onSelect }: { onSelect: (id: string) => void }) {
  const candidates = EDGES.filter((e) => e.strength === "candidate");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-2xl" role="group" aria-label="Who works on this cluster diagram">
        {DISEASES.map((d) => (
          <line key={`c-${d.id}`} x1={CX} y1={CY} x2={DPOS[d.id]!.x} y2={DPOS[d.id]!.y} className="stroke-border" strokeWidth={2} />
        ))}
        {candidates.map((e) => (
          <line
            key={e.id}
            x1={DPOS[e.from]!.x} y1={DPOS[e.from]!.y} x2={DPOS[e.to]!.x} y2={DPOS[e.to]!.y}
            className="stroke-evidence-inferred" strokeWidth={2.5} strokeDasharray="7 6"
          />
        ))}
        {TRIAL.diseases.map((id) => (
          <line key={`t-${id}`} x1={TRIAL.x} y1={TRIAL.y} x2={DPOS[id]!.x} y2={DPOS[id]!.y} className="stroke-evidence-mechanisms" strokeWidth={1.5} />
        ))}
        {researchers.map((r, i) =>
          r.diseases.map((id) => {
            const p = researcherPos(r.diseases as string[], i, r.id);
            return <line key={r.id + id} x1={p.x} y1={p.y} x2={DPOS[id]!.x} y2={DPOS[id]!.y} className="stroke-primary/40" strokeWidth={2} />;
          }),
        )}
        <circle cx={CX} cy={CY} r={34} className="fill-accent" />
        <text x={CX} y={CY + 5} textAnchor="middle" className="fill-accent-foreground text-[13px] font-bold">Lysosome</text>
        <g>
          <circle cx={TRIAL.x} cy={TRIAL.y} r={9} className="fill-evidence-mechanisms" />
          <text x={TRIAL.x} y={TRIAL.y + 24} textAnchor="middle" className="fill-foreground text-[11px]">Shared trial</text>
        </g>
        {DISEASES.map((d) => {
          const p = DPOS[d.id]!;
          const below = p.y >= CY;
          return (
            <g key={d.id}>
              <circle cx={p.x} cy={p.y} r={20} fill={d.accent} />
              <text x={p.x} y={below ? p.y + 38 : p.y - 28} textAnchor="middle" className="fill-foreground text-[13px] font-bold">
                {d.id === "npc" ? "NPC" : d.name.replace(" disease", "")}
              </text>
            </g>
          );
        })}
        {researchers.map((r, i) => {
          const p = researcherPos(r.diseases as string[], i, r.id);
          return (
            <g
              key={r.id}
              role="button"
              tabIndex={0}
              aria-label={`${r.name}, show card`}
              className="cursor-pointer focus:outline-none [&:focus-visible>circle]:stroke-accent [&:focus-visible>circle]:stroke-[5]"
              onClick={() => onSelect(r.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(r.id))}
            >
              <circle cx={p.x} cy={p.y} r={11} className="fill-primary" />
              <text x={p.x} y={p.y + 26} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {r.name.split(",")[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-accent" /> Lysosome (shared biology)</li>
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" /> Researcher (select to see card)</li>
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-evidence-mechanisms" /> Shared trial</li>
        <li className="flex items-center gap-2"><span className="h-0 w-6 border-t-2 border-dashed border-evidence-inferred" /> Candidate connection, still being studied</li>
      </ul>
    </div>
  );
}
