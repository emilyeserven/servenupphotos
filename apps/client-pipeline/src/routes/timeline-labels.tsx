import { createFileRoute } from "@tanstack/react-router";
import { TimelineLabelsPage } from "@/components/timeline-labels/page";

export const Route = createFileRoute("/timeline-labels")({
  component: TimelineLabelsPage,
});
