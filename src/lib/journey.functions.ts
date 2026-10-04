import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { symptomReply, visitChecklist } from "./journey.server";

export const askSymptomAssistant = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(40),
    context: z.string().max(4000),
  }).parse(d))
  .handler(async ({ data }) => symptomReply(data.messages, data.context, getRequest().signal));

export const generateVisitChecklist = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ visit: z.string().min(1).max(300), context: z.string().max(4000) }).parse(d))
  .handler(async ({ data }) => visitChecklist(data.visit, data.context, getRequest().signal));
