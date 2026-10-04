# Apply this update to Rarely Alone

Paste into Lovable after uploading the files from `rarelyalone_changes_flat.zip`:

> Apply these files to the paths in the table below. Update this existing app; do not recreate it. Install the updated package.json dependencies. Keep Resources, My Journey, Find My Circle, and the curated Atlas data unchanged. The API is already mounted in src/server.ts; do not create a separate Python service, Docker deployment, database, or Supabase function. Reuse this project's server-side LOVABLE_API_KEY. Test Dashboard → live disease search → exact disease selection → research → proximity-map line → evidence panel. Keep the full indexing, independent disease enrichment, graph scoring, source coverage and hypothesis protocol in these files.

| Uploaded filename | Project path | Action |
|---|---|---|
| package.json | package.json | Replace |
| bun.lock | bun.lock | Replace |
| vite.config.ts | vite.config.ts | Replace |
| server.ts | src/server.ts | Replace |
| dashboard.tsx | src/routes/dashboard.tsx | Replace |
| LiveAtlas.tsx | src/components/atlas/LiveAtlas.tsx | Add |
| AtlasResults.tsx | src/components/atlas/AtlasResults.tsx | Add |
| atlas-backend.ts | src/lib/atlas-live/atlas-backend.ts | Add |
| atlas-browser.ts | src/lib/atlas-live/atlas-browser.ts | Add |
| atlas-core.ts | src/lib/atlas-live/atlas-core.ts | Add |
| atlas-index.ts | src/lib/atlas-live/atlas-index.ts | Add |
| atlas-live.server.ts | src/lib/atlas-live/atlas-live.server.ts | Add |
| atlas-sources.ts | src/lib/atlas-live/atlas-sources.ts | Add |
| atlas-worker.ts | src/lib/atlas-live/atlas-worker.ts | Add |
| atlas.sql | src/lib/atlas-live/atlas.sql | Add; imported automatically, no manual SQL step |
| atlas-live.test.tsx | src/test/atlas-live.test.tsx | Add; three functional smoke tests |
| LOVABLE_UPDATE.md | LOVABLE_UPDATE.md | Add; instructions |

Flat uploads are fine. The table tells Lovable where each file belongs so the existing app's imports work. `rarelyalone_updated.zip` contains the full updated source as an alternative; you do not need both archives.

## How it runs

- Dashboard keeps the five curated conditions and adds **Search the full disease index**. Entering another disease opens live search. Select an exact concept to research three candidate neighbors; all neighborhood pairs are compared.
- The existing app server proxies approved biomedical sources and handles structured AI extraction / Ask the Atlas. Keys stay on the server. Default model: `openai/gpt-6-luna`, using the same Lovable gateway as the existing assistant.
- A browser worker runs the full TypeScript pipeline and SQL scorer with embedded PostgreSQL (PGlite). The HPO / MONDO / Reactome index, caches and jobs persist on this device in browser storage. No external database, Docker or bootstrap command is required.
- First use downloads and indexes the datasets, which can take several minutes and substantial local storage. Later searches reuse the index. Keep the tab open while working; **Open / resume my last research** resumes a saved job. Use one Atlas tab at a time. Clearing site data clears this cache; jobs are not shared between devices or processed after the page closes.
- Retrieval uses sparse HPO/gene/pathway postings, IDF and rank fusion, then bounded literature expansion. It does not enrich every disease or ask the LLM to invent similarity scores. Independent disease profiles, five graph-derived dimensions, counterevidence and evidence-linked experimental proposals are retained. The 2D layout is an approximation of the calculated similarities.
- OMIM text requires optional server secret `OMIM_API_KEY`. `NCBI_API_KEY` and `NCBI_EMAIL` are optional. Other unavailable sources, including organization pages, are reported in coverage. No disease's complete biology or exhaustive search is guaranteed. Unsupported dimensions stay unknown and hypotheses are omitted when evidence is insufficient.
- AI must be enabled in the Lovable project. Missing credentials are shown explicitly. Optional server settings: `ATLAS_MODEL`, `ATLAS_INPUT_USD`, `ATLAS_OUTPUT_USD`, `ATLAS_DAILY_USD`. Change the price settings if changing models. Cost estimates use public list prices; Lovable credits can differ. Browser job limits and instance-local server spending guards are MVP controls, not durable billing guarantees.

## Checks performed

Production build and TypeScript check passed. Three functional UI smoke tests passed: disease selection to results, line-to-evidence drilldown / hypotheses, and graph retrieval before an Ask answer. Real Europe PMC and HPO byte-range requests succeeded through the new server proxy. The protected pages, their supporting modules and the curated science files are byte-for-byte unchanged.

The source archive contains no Lovable credential, so a paid model call was not run. A full new bulk-index download and real browser worker run were not completed here. The UI tests use fixtures; they do not claim scientific validation. Existing pipeline checks were not expanded into another accuracy-testing suite.

Implementation references: [PGlite / Vite](https://pglite.dev/docs/bundler-support), [Lovable AI](https://docs.lovable.dev/features/ai), [default model and list pricing](https://developers.openai.com/api/docs/models/gpt-6-luna). Checked 4 October 2026.
