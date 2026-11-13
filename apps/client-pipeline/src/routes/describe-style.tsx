import { createFileRoute } from "@tanstack/react-router";
import { DescribeStylePage } from "@/components/describe-style/describe-style-page";
import { type GridFilters, parseGridFilters } from "@/components/gallery/grid-filters";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";

export const Route = createFileRoute("/describe-style")({
  component: DescribeStyleRoute,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): GridFilters => parseGridFilters(search),
});

/** A prompt that asks an LLM to describe the photographer's style from links to their photos. */
function DescribeStyleRoute() {
  return (
    <Page
      wide
      title="Describe my style"
      description="Copy a prompt that links small versions of your photos and asks an LLM to describe your photography style. Narrow the photos down with the portfolio's filters to ask about one trip, a year, a place or a camera."
    >
      <GitHubGate>{() => <DescribeStylePage />}</GitHubGate>
    </Page>
  );
}
