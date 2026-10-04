// Server-only: grounded answer generation through Lovable AI Gateway (OpenAI Responses).
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, APICallError, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { retrieveEvidence, validSourceIds, REFERENTIAL, type EvidenceSource } from "./ask-evidence";
import { atlasEvidence, detectAtlasDiseases } from "./ask-atlas";
import { datasetEvidence } from "./rare-dataset.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export interface AskSource { id: string; title: string; sourceName: string; url: string; kind: EvidenceSource["kind"] }
export type AskResult =
  | { status: "answered"; answer: string; uncertainty: string; followUpSuggestions: string[]; sources: AskSource[]; recognized: string[]; failedSources: string[] }
  | { status: "insufficient"; answer: string; recognized: string[]; failedSources: string[] }
  | { status: "error"; message: string };

const schema = z.object({
  answer: z.string(),
  sourceIdsUsed: z.array(z.string()),
  uncertainty: z.string(),
  followUpSuggestions: z.array(z.string()),
});

const INSTRUCTIONS = `You are Ask Rarely Alone, an educational assistant for rare-disease families.
Answer ONLY from the numbered sources provided. Do not use outside knowledge.
Rules:
- Cite only source IDs that appear in the provided list (e.g. "S1"). List every one you relied on in sourceIdsUsed.
- If the sources do not answer the question, say plainly that the linked sources don't cover it.
- Never diagnose the reader. Never recommend starting, stopping, or changing any treatment; a study is research, not a recommendation.
- Tone follows the audience line below; short paragraphs; about 120-180 words. Plain text only: no markdown, no asterisks; simple '- ' bullets are fine.
- Answer the question as asked; mention a recognized disease only if it helps answer it.
- uncertainty: one or two sentences on what the sources do not establish.
- If every source is a clinical study (kind: trial), say plainly that the available sources are research studies, not general disease education.
- Curated Atlas sources and the Atlas comparison note come first for the five curated diseases. Use the evidence-type labels as given (e.g. "human-cell and animal experiment", "curated disease biology"). Say which evidence is documented/direct versus inferred/candidate, and say plainly when evidence is preclinical (cells, animals) or uncertain. Atlas similarity scores describe shared biology only; shared biology never proves a shared treatment.
- PubMed and NIH RePORTER sources give only titles and metadata: you may say a study or project exists and what its title states, never what it found.
- followUpSuggestions: 2-3 short follow-up questions answerable from similar sources; each must name the disease or gene explicitly (e.g. "What does HEXB do?"), never "it" or "these".`;

function makeProvider(apiKey: string) {
  return createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

export type Audience = "patients" | "research";
const AUDIENCE: Record<Audience, string> = {
  patients: "Audience: patients and families. Use plain, warm, everyday words and explain any technical term.",
  research: "Audience: researchers and advocates. Technical language (mechanisms, model systems, evidence gaps, study design) is welcome, still grounded only in the sources.",
};

export async function askRarelyAlone(question: string, signal?: AbortSignal, context: string[] = [], audience: Audience = "patients"): Promise<AskResult> {
  // Curated Atlas diseases named now; otherwise those from the conversation when the question refers back.
  let atlasIds = detectAtlasDiseases(question);
  if (!atlasIds.length && REFERENTIAL.test(question)) atlasIds = detectAtlasDiseases(context.join(" | "));
  const atlas = atlasEvidence(atlasIds);
  const live = await retrieveEvidence(question, undefined, context);
  const ds = datasetEvidence(`${question} ${atlasIds.length ? "" : REFERENTIAL.test(question) ? context.join(" | ") : ""}`);
  const seen = new Set(atlas.sources.map((s) => s.url));
  const rest = [...live.sources, ...ds.sources].filter((s) => !seen.has(s.url) && (seen.add(s.url), true));
  const ev = { ...live, sources: [...atlas.sources, ...rest].slice(0, 20).map((s, i) => ({ ...s, id: `S${i + 1}` })) };
  const recognized = [...new Set([...atlas.names, ...live.diseases.map((d) => d.name), ...ds.names])];
  if (!ev.sources.length) {
    return {
      status: "insufficient",
      answer: "I couldn't find enough sourced information to answer this question. Try naming a specific disease or gene, such as Sandhoff disease or HEXB.",
      recognized, failedSources: ev.failedSources,
    };
  }
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { status: "error", message: "The assistant isn't configured right now." };

  const KIND = { trial: "clinical study", education: "patient education", atlas: "curated Atlas evidence", research: "research literature / funding" } as const;
  const sourceBlock = ev.sources.map((s) => `[${s.id}] (${KIND[s.kind]}) ${s.title} (${s.sourceName})\n${s.text || "(no summary provided)"}`).join("\n\n");
  try {
    const result = streamText({
      model: makeProvider(apiKey).responses(MODEL),
      instructions: `${INSTRUCTIONS}\n${AUDIENCE[audience]}`,
      prompt: `Question: ${question}\n\nRecognized disease(s): ${recognized.join(", ") || "none"}${atlas.notes ? `\n\n${atlas.notes}` : ""}\n\nSources:\n${sourceBlock}`,
      output: Output.object({ schema }),
      ...(signal ? { abortSignal: signal } : {}),
      maxRetries: 0,
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
      },
    });
    const out = await result.output;
    const ids = validSourceIds(out.sourceIdsUsed, ev.sources);
    return {
      status: "answered",
      answer: out.answer.trim(),
      uncertainty: out.uncertainty.trim(),
      followUpSuggestions: out.followUpSuggestions.slice(0, 3),
      sources: ev.sources.filter((s) => ids.includes(s.id)).map(({ id, title, sourceName, url, kind }) => ({ id, title, sourceName, url, kind })),
      recognized, failedSources: ev.failedSources,
    };
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) return { status: "error", message: "The assistant couldn't put together an answer. Please try again." };
    if (APICallError.isInstance(e)) {
      const s = e.statusCode;
      console.error("Ask Rarely Alone gateway error", s, e.message);
      if (s === 402) return { status: "error", message: "The assistant is paused because AI credits have run out." };
      if (s === 429) return { status: "error", message: "The assistant is busy right now. Please wait a moment and try again." };
      if (s === 403) return { status: "error", message: "The assistant isn't available for this workspace right now." };
    }
    console.error("Ask Rarely Alone failed", e);
    return { status: "error", message: "The assistant is unavailable right now. The resources below are still available." };
  }
}
