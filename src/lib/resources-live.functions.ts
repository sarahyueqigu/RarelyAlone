import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchResourcesAggregate } from "./resources-search";
import { educationToResource, trialToResource } from "./resources-live";

export const searchLiveResources = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const r = await searchResourcesAggregate(data.q);
    return {
      recognizedAs: r.normalizedDisease?.preferredName ?? null,
      education: r.patientEducation.map(educationToResource),
      trials: r.clinicalTrials.map((s) => trialToResource(s, !!r.curatedTrialIds?.includes(s.nctId))),
      failedSources: r.errors.map((e) => e.source),
    };
  });
