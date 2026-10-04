import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { askRarelyAlone } from "./ask.server";

export const askQuestion = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ question: z.string().trim().min(3).max(400), context: z.array(z.string().max(120)).max(6).optional(), audience: z.enum(["patients", "research"]).optional() }).parse(d))
  .handler(async ({ data }) => askRarelyAlone(data.question, getRequest().signal, data.context ?? [], data.audience ?? "patients"));
