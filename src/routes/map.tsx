import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { pageHead } from "@/lib/seo";
import { compare, pairs } from "@/lib/atlas/graph";
import { proximityLayout } from "@/lib/atlas/layout";
import { Button } from "@/components/ui/button";
import "@/map-flow.css";

const LABELS: Record<string, string> = {
  tay: "Tay–Sachs",
  sand: "Sandhoff disease",
  npc: "Niemann–Pick C",
  gaucher: "Gaucher disease",
  spg: "SPG11",
};

export const Route = createFileRoute("/map")({
  validateSearch: (s) => z.object({ focus: z.enum(["tay", "sand", "npc", "gaucher", "spg"]).optional() }).parse(s),
  head: () => ({ ...pageHead("Biological proximity map", "Five rare diseases placed by computed biological similarity."), links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap" }] }),
  component: MapPage,
});

const W = 1000, H = 600, PAD = 125;

function MapPage() {
  const { focus } = Route.useSearch();
  const navigate = useNavigate();
  const open = (id: string) => navigate({ to: "/map/pair/$pairId", params: { pairId: id }, search: focus ? { focus } : {} });
  const [hover, setHover] = useState<string | null>(null);

  const placed = useMemo(() => {
    const { nodes } = proximityLayout();
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const s = Math.min((W - 2 * PAD) / (maxX - minX || 1), (H - 2 * PAD) / (maxY - minY || 1));
    const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
    return Object.fromEntries(nodes.map((n) => [n.id, { x: ox + (n.x - minX) * s, y: oy + (n.y - minY) * s }]));
  }, []);
  const scores = useMemo(() => Object.fromEntries(pairs.map((p) => [p.id, compare(p.a, p.b).overall])), []);
  return (
    <div className="map-flow -mx-4 min-h-[calc(100vh-10rem)] px-5 pb-16 pt-8 md:-mx-6 md:px-10 md:pt-12">
      <div className="mx-auto max-w-[1360px]">
      <Link to="/dashboard" className="map-blue text-sm font-medium underline underline-offset-4">← New search</Link>
      <header className="map-reveal mt-9 max-w-3xl">
        <p className="map-blue text-xs font-semibold uppercase">Disease landscape / five conditions</p>
        <h1 className="mt-3 text-3xl leading-tight md:text-5xl">Biological proximity</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed opacity-75 md:text-lg">
          Closer diseases share more biology, as computed from the evidence graph. Select a line to open the evidence for that connection.
        </p>
      </header>

      <div className="map-reveal-late mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_290px]">
      <div className="relative min-w-0 border-y map-rule py-2 md:py-4">
        <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[580px] w-full" role="group" aria-label="Five-disease proximity map">
          <title>Biological proximity of five diseases, positioned from all ten pairwise comparisons</title>
          {pairs.map((p) => {
            const a = placed[p.a], b = placed[p.b];
            if (!a || !b) return null;
            const active = hover === p.id;
            const dashed = p.role === "Exploratory";
            return (
              <g
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`${p.label}, ${p.role}. Similarity ${Math.round(scores[p.id]!)}`}
                className="cursor-pointer focus:outline-none [&:focus-visible>line:last-child]:stroke-accent"
                onClick={() => open(p.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(p.id))}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
              >
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={36} />
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  className={`map-line ${active ? "stroke-primary" : "stroke-primary/55"}`}
                  strokeWidth={active ? 5 : 2.5}
                  strokeDasharray={dashed ? "10 9" : undefined}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {Object.entries(placed).map(([id, p]) => {
            const isFocus = id === focus;
            const pts = Object.values(placed);
            const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length, cy = pts.reduce((a, q) => a + q.y, 0) / pts.length;
            const dx = p.x - cx, dy = p.y - cy, len = Math.hypot(dx, dy) || 1;
            const lx = p.x + (dx / len) * 44, ly = p.y + (dy / len) * 44 + 6;
            const anchor = Math.abs(dx / len) < 0.4 ? "middle" : dx > 0 ? "start" : "end";
            return (
              <g key={id} className="map-node">
                <title>{id === focus ? `${id === "tay" ? "Tay–Sachs disease" : LABELS[id]}, your search` : LABELS[id]}</title>
                {isFocus && <circle cx={p.x} cy={p.y} r={29} className="fill-primary/10" />}
                <circle cx={p.x} cy={p.y} r={isFocus ? 14 : 11} className={isFocus ? "fill-primary stroke-surface" : "fill-surface stroke-primary"} strokeWidth={isFocus ? 5 : 2.5} />
                <circle cx={p.x} cy={p.y} r={isFocus ? 4 : 3} className={isFocus ? "fill-surface" : "fill-primary"} />
                <text
                  x={lx} y={ly} textAnchor={anchor}
                  className={`fill-foreground text-[17px] ${isFocus ? "font-semibold" : ""}`}
                >
                  {LABELS[id]}
                </text>
              </g>
            );
          })}
        </svg>
        </div>
        <p className="px-2 pb-2 text-xs opacity-60">Positions reflect all ten pairwise similarities. Only the three defined comparisons are connected. <span className="md:hidden">Scroll the map sideways to see every label.</span></p>
      </div>
      <aside className="border-t-2 border-primary pt-5 lg:mt-16" aria-label="Map connections">
        <p className="map-blue text-xs font-semibold uppercase">Connection index</p>
        <h2 className="mt-2 text-xl leading-snug">Three documented comparisons</h2>
        <div className="mt-6 divide-y map-rule">
          {pairs.map((p, i) => <div key={p.id} className="py-4 first:pt-0">
            <p className="text-xs opacity-60">0{i + 1} / {p.role}</p>
            <Button variant="link" className="map-ink mt-1 h-auto whitespace-normal p-0 text-left text-base font-medium leading-snug underline-offset-4 hover:underline" onClick={() => open(p.id)}>{p.label} ↗</Button>
            <p className="map-blue mt-2 font-mono text-sm">{Math.round(scores[p.id] ?? 0)} / 100</p>
          </div>)}
        </div>
        <Link to="/community" className="map-blue mt-2 inline-block text-sm underline underline-offset-4">Find circles for this disease →</Link>
        <div className="mt-4 space-y-3 border-t map-rule pt-5 text-xs opacity-75">
          <p><span className="mr-2 inline-block w-7 border-t-2 border-primary align-middle" /> Positive control</p>
          <p><span className="mr-2 inline-block w-7 border-t-2 border-dashed border-primary align-middle" /> Exploratory connection</p>
          {focus && <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-primary align-middle" /> Your search</p>}
        </div>
      </aside>
      </div>
      </div>
    </div>
  );
}
