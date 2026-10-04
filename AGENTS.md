<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Shared chrome (header, banner, footer) lives in `src/components/layout` and is rendered once in `__root.tsx` — keeps every route consistent.
- App-wide client state (experience mode, selected condition, saved items, inquiries) lives in React context providers mounted in `__root.tsx`, persisted to localStorage after hydration — avoids SSR mismatches and lets later sections reuse it.
- Mock data lives in typed files under `src/data/` — so it can be swapped for pipeline data without touching UI.
- Cross-page flows (intro dialog, brief drawer) are opened via `useFlows()` from `src/components/community/flows.tsx` — one mounted instance, focus returns to the trigger.
- Scientific data (`src/data/diseases/*.json`, `src/data/nodes.json`, `src/data/sources.json`) and logic (`src/lib/atlas/`) are the verbatim source of truth — never edit scores, evidence, or relationships; adapt only imports/types. `src/test/atlas-data.test.ts` guards that all pairs compare.
- Disease-cluster facts for Community live in `src/data/diseases.ts` and `src/data/edges.ts` (separate from the Atlas science files); plates render via `DiseasePlate`. The map flow is `/dashboard` → `/map` → `/map/pair/$pairId` (flat `map_` file so it does not nest under `/map`).
- The map flow uses a route-scoped stylesheet rather than global theme overrides, so its editorial visual system does not alter Community, Resources, or other pages.
- Find My Circle connections (org relation, biology status, research action) are derived in `src/data/circle-connections.ts` from existing sourced data and Atlas files — one place enforces provenance and label rules.
- Ask Rarely Alone answers only from retrieved evidence: curated Atlas files first (`src/lib/ask-atlas.ts`), then `src/lib/resources-search.ts` (filtered in `src/lib/ask-evidence.ts`), then the rare-disease dataset `src/data/rarediseases.json` read server-side via `src/lib/rare-dataset.server.ts` (single copy; replace in place on update); the AI call lives server-side in `src/lib/ask.server.ts` and only cited, supplied source IDs are shown — keeps answers grounded and citations real.
- Resources and Ask queries pass through `src/lib/query-interpret.ts` (framing removal) and the explicit, case-insensitive alias map in `resources-search.ts` before Orphadata — deterministic, no fuzzy guessing.
- Audience mode (`useExperience`) decides Resources sections and nav availability; `/` redirects to `/dashboard`, the app home — one toggle, no blank homepage.
- Clinical Trials on /resources adds ClinicalTrials.gov records the curated Atlas cites for the searched disease by exact NCT lookup, and groups trials into active/recruiting vs completed/non-recruiting — keeps Resources consistent with Ask Rarely Alone without fabricating trials; preclinical sources never enter this section.
- Find My Circle has a second page, `/community/explore`, that searches every disease in the rare-disease dataset via `src/lib/circle-explore.server.ts` (server-only); the original curated `/community` page is kept unchanged — the dataset is too large for the client and the curated page has richer hand-checked links. The explore page presents only clinical trials, NIH-funded projects and literature — no Orphanet directory, duplicate-effort, or contact sections.
- On `/community`, the dataset-disease tables (`src/components/community/DatasetDiseaseTables.tsx`) lead with Related biology, and the clinical-trial and funding sections collapse from their own title bar with counts shown as separate chips beside the title — keeps the highest-value facts first and long tables out of the way without burying the totals.
