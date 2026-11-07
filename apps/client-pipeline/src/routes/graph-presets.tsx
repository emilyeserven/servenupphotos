import { createFileRoute } from "@tanstack/react-router";
import { GraphPresetsPage } from "@/components/graph-presets/page";

export const Route = createFileRoute("/graph-presets")({
  component: GraphPresetsPage,
});
