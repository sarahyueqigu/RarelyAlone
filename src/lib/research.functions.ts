import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { researchFor } from "./rare-dataset.server";
import { expandAliases } from "./resources-search";
import { atlasResearchFor, recordKey } from "./atlas-research";

/** Dataset PubMed + NIH metadata first, then curated Atlas research citations (deduplicated against the dataset). */
export const getResearch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const q = expandAliases(data.q);
    const matches = researchFor(q);
    const datasetKeys = new Set(
      matches.flatMap((m) => m.pubmed?.recentArticles ?? []).flatMap((a) => [
        recordKey({ pmid: a.pmid, doi: null, nct: null, url: a.url }),
        ...(a.doi ? [recordKey({ pmid: null, doi: a.doi.toLowerCase(), nct: null, url: "" })] : []),
      ]),
    );
    const atlas = atlasResearchFor(`${data.q} ${q}`, datasetKeys);
    return { matches, atlas: atlas && atlas.records.length ? atlas : null };
  });
