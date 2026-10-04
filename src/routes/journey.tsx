import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { JourneyPage } from "@/components/journey/JourneyPage";

export const Route = createFileRoute("/journey")({
  head: () => pageHead("My Journey", "Keep your appointments, tests and milestones in one care timeline, prepare for visits with a checklist, and put symptoms into words."),
  component: JourneyPage,
});
