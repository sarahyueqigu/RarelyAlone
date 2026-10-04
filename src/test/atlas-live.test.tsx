import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AtlasResults, type AtlasResult } from "@/components/atlas/AtlasResults";
import { LiveAtlas } from "@/components/atlas/LiveAtlas";
import { atlasCall, askAtlas } from "@/lib/atlas-live/atlas-browser";

vi.mock("@/lib/experience", () => ({ useExperience: () => ({ experience: "research" }) }));
vi.mock("@/lib/atlas-live/atlas-browser", () => ({ atlasCall: vi.fn(), askAtlas: vi.fn(), LAST_JOB: "test-atlas-job", pause: () => Promise.resolve() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

// Functional fixtures only; this is not a biomedical accuracy test.
const edge = (d: string) => ({ id: `e-${d}`, disease: d, source: d, target: "m", relationship: "has", summary: "Observed mechanism in a cellular model.", sourceIds: ["S1"], direct: true, evidenceType: "cell experiment", confidence: .65, context: "cells", contradictions: [], scoreEligible: true, polarity: "support" });
const data: AtlasResult = {
  query: "a", generatedAt: "2026-10-04", diseases: [{ id: "a", name: "Disease Alpha", coverage: [] }, { id: "b", name: "Disease Beta", coverage: [] }],
  nodes: [{ id: "a", label: "Disease Alpha", type: "disease", dimension: null }, { id: "b", label: "Disease Beta", type: "disease", dimension: null }, { id: "m", label: "Shared mechanism", type: "mechanism", dimension: "mechanism" }],
  edges: [edge("a"), edge("b")], sources: [{ id: "S1", title: "Fixture publication", url: "https://pubmed.ncbi.nlm.nih.gov/1/", type: "publication" }],
  comparisons: [{ a: "a", b: "b", overall: 65, confidence: 65, coverage: 1, association: true, strongest: "m", metrics: [{ id: "mechanism", score: 65, numerator: .65, denominator: 1 }], paths: [{ id: "m", dimension: "mechanism", pathA: ["e-a"], pathB: ["e-b"] }], counterevidence: [], hypotheses: [{ candidate: "Cell assay", status: "Exploratory", rationale: "A shared mechanism.", existingEvidence: [], missingEvidence: "Transferability.", proposedExperiment: "Compare cells with corrected controls.", falsifier: "No replicated defect.", sourceIds: ["S1"] }] }],
  network: { nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 1, y: 1 }], note: "Approximate layout" },
  coverageWarning: "Bounded search", indexSnapshot: { version: "fixture", diseases: 2 }, cost: { llmCalls: 0, httpRequests: 0, estimatedOrReservedUSD: 0 },
};

it("opens an association line, evidence ledger, source links and research hypothesis", () => {
  render(<AtlasResults data={data} onNewSearch={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Disease Alpha and Disease Beta/ }));
  expect(screen.getAllByRole("button", { name: "Shared mechanism" }).length).toBe(2);
  fireEvent.click(screen.getByRole("button", { name: "Evidence ledger" }));
  expect(screen.getAllByText("Observed mechanism in a cellular model.").length).toBe(2);
  expect(screen.getAllByRole("link", { name: /S1/ })[0]).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/1/");
  fireEvent.click(screen.getByRole("button", { name: "Research hypotheses" }));
  expect(screen.getByText("Compare cells with corrected controls.")).toBeInTheDocument();
});

it("runs exact disease selection through the research result screen", async () => {
  vi.mocked(atlasCall).mockImplementation(async action => {
    if (action === "status") return { indexReady: true, llmEnabled: true };
    if (action === "search") return { matches: [{ id: "a", name: "Disease Alpha" }] };
    if (action === "query") return { jobId: "fixture-job" };
    return { status: "complete", result: data };
  });
  render(<LiveAtlas initialQuery="Disease Alpha" onBack={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  fireEvent.click(await screen.findByRole("button", { name: /Disease Alpha a/ }));
  expect(await screen.findByRole("heading", { name: "Biological proximity" })).toBeInTheDocument();
  expect(localStorage.getItem("test-atlas-job")).toBe("fixture-job");
});

it("retrieves graph evidence before asking the model and renders citations", async () => {
  vi.mocked(askAtlas).mockResolvedValue({ answer: "Shared cell evidence [S1].", uncertainty: "No clinical equivalence.", sourceIds: ["S1"] });
  render(<AtlasResults data={data} onNewSearch={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Disease Alpha and Disease Beta/ }));
  fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Why are they similar?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(await screen.findByText("Shared cell evidence [S1].")).toBeInTheDocument();
  expect(vi.mocked(askAtlas).mock.calls[0]![0]["evidence"]).toHaveLength(2);
});
