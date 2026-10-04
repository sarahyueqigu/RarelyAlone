// Server-only: My Journey symptom assistant + visit checklist via Lovable AI Gateway (Responses).
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, APICallError, NoObjectGeneratedError } from "ai";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const OPTS = { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } } as const;

export type JourneyResult<T> = { ok: true; value: T } | { ok: false; message: string };

function provider(apiKey: string) {
  return createOpenAI({ baseURL: GATEWAY, apiKey, headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
}

function failure(e: unknown): { ok: false; message: string } {
  if (APICallError.isInstance(e)) {
    const s = e.statusCode;
    console.error("Journey gateway error", s, e.message);
    if (s === 402) return { ok: false, message: "The assistant is paused because AI credits have run out." };
    if (s === 429) return { ok: false, message: "The assistant is busy. Please wait a moment and try again." };
    if (s === 403) return { ok: false, message: "The assistant isn't available for this workspace right now." };
  } else console.error("Journey AI failed", e);
  return { ok: false, message: "The assistant is unavailable right now. Please try again." };
}

const CHAT_INSTRUCTIONS = `You help a rare-disease patient or caregiver put their symptoms into clear words to share with their care team.
- Ask one or two gentle, specific follow-up questions at a time (when it started, how often, how long, how severe 0-10, what makes it better or worse, effect on daily life).
- Reflect back what they said in plain language. When you have enough, offer a short "Symptom note" summary they could read to a doctor, as simple '- ' bullets.
- Never diagnose, never suggest treatments or medication changes. If they describe an emergency (chest pain, trouble breathing, fainting, thoughts of self-harm), tell them to contact emergency services now.
- Warm, brief (under 150 words), plain text only, no markdown headings or asterisks.`;

export async function symptomReply(messages: { role: "user" | "assistant"; content: string }[], context: string, signal?: AbortSignal): Promise<JourneyResult<string>> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, message: "The assistant isn't configured right now." };
  try {
    const r = streamText({
      model: provider(apiKey).responses(MODEL),
      instructions: `${CHAT_INSTRUCTIONS}\n\nWhat the user has logged in their journey (for context only):\n${context || "(nothing yet)"}`,
      messages,
      maxRetries: 0,
      ...(signal ? { abortSignal: signal } : {}),
      providerOptions: OPTS,
    });
    const text = (await r.text).trim();
    return text ? { ok: true, value: text } : { ok: false, message: "The assistant didn't reply. Please try again." };
  } catch (e) { return failure(e); }
}

const checklistSchema = z.object({ items: z.array(z.string()) });

export async function visitChecklist(visit: string, context: string, signal?: AbortSignal): Promise<JourneyResult<string[]>> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, message: "The assistant isn't configured right now." };
  try {
    const r = streamText({
      model: provider(apiKey).responses(MODEL),
      instructions: `Create a practical preparation checklist for a rare-disease patient's upcoming medical visit. 5 to 8 items, each under 12 words, concrete things to bring, note or ask. Tailor to the visit and the journey events. No diagnoses or treatment advice.`,
      prompt: `Upcoming visit: ${visit}\n\nJourney so far:\n${context || "(nothing logged)"}`,
      output: Output.object({ schema: checklistSchema }),
      maxRetries: 0,
      ...(signal ? { abortSignal: signal } : {}),
      providerOptions: OPTS,
    });
    const out = await r.output;
    const items = out.items.map((s) => s.trim()).filter(Boolean).slice(0, 8);
    return items.length ? { ok: true, value: items } : { ok: false, message: "Couldn't build a checklist. Please try again." };
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) return { ok: false, message: "Couldn't build a checklist. Please try again." };
    return failure(e);
  }
}
