import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { diseaseProfile, listDiseases } from "./circle-explore.server";

export const getDiseaseList = createServerFn({ method: "GET" }).handler(async () => listDiseases());

export const getDiseaseProfile = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => diseaseProfile(data.name));
