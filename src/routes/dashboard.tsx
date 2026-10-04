import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { pageHead } from "@/lib/seo";
import "@/map-flow.css";

import { ATLAS_ID, DISEASES as CATALOG, type DiseaseId } from "@/data/diseases";
import { useCommunity } from "@/lib/community-store";

const LiveAtlas = lazy(() => import("@/components/atlas/LiveAtlas").then(m => ({ default: m.LiveAtlas })));

// Display names and IDs come from the shared disease catalog.
const DISEASE_IDS = Object.fromEntries(CATALOG.map((d) => [d.name, d.id])) as Record<string, DiseaseId>;
const DISEASES = CATALOG.map((d) => d.name);

export const Route = createFileRoute("/dashboard")({
  head: () => ({ ...pageHead("Dashboard", "Look up a rare disease to get started with Rarely Alone."), links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap" }] }),
  component: Page,
});

function Page() {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [live, setLive] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    return q ? DISEASES.filter((d) => d.toLowerCase().includes(q)) : DISEASES;
  }, [value]);

  const navigate = useNavigate();
  const { setCondition } = useCommunity();
  const choose = (d: string) => {
    const id = DISEASE_IDS[d]!;
    setCondition(id);
    setValue(d);
    setOpen(false);
    setActive(-1);
    navigate({ to: "/map", search: { focus: ATLAS_ID[id] } });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0 && matches[active]) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && value.trim().length >= 2) {
      e.preventDefault();
      const exact = DISEASES.find(d => d.toLowerCase() === value.trim().toLowerCase());
      if (exact) choose(exact); else setLive(true);
    }
  };

  const showList = open && matches.length > 0;

  if (live) return <Suspense fallback={<p className="py-16 text-center">Opening Atlas…</p>}><LiveAtlas initialQuery={value} onBack={() => setLive(false)} /></Suspense>;

  return (
    <div className="map-flow -mx-4 flex min-h-[calc(100vh-11rem)] flex-col items-center justify-center px-6 py-20 md:-mx-6">
      <div className="map-reveal w-full max-w-2xl">
      <p className="map-blue mb-5 text-center text-xs font-semibold uppercase">Rare disease landscape / 01</p>
      <h1 className="text-center text-3xl leading-tight md:text-5xl">Which disease are you exploring?</h1>
      <p className="mt-5 text-center text-base opacity-70">Explore the curated map, or research another disease.</p>
      <div className="relative mx-auto mt-10 w-full max-w-xl">
        <label htmlFor="disease-input" className="sr-only">
          Disease name
        </label>
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="disease-input"
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Start typing a disease name"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="map-paper map-ink h-16 w-full rounded-md border map-rule pl-14 pr-6 text-lg outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:shadow-md"
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="map-paper absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-md border map-rule py-2 shadow-lg"
          >
            {matches.map((d, i) => (
              <li
                key={d}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(d);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-6 py-3 text-foreground ${i === active ? "bg-tint-light text-primary" : ""}`}
              >
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-5 text-center text-xs opacity-55">Tay–Sachs · Sandhoff · Niemann–Pick C · Gaucher · SPG11</p>
      <div className="mt-8 text-center"><button onClick={() => setLive(true)} className="map-blue text-sm underline underline-offset-4">{value.trim() ? `Research “${value.trim()}” with live sources →` : "Search the full disease index →"}</button></div>
      </div>
    </div>
  );
}
