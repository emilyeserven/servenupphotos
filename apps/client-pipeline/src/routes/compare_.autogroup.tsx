import { createFileRoute } from "@tanstack/react-router";
import { AutogroupCard } from "@/components/compare/autogroup-card";
import { Page } from "@/components/page";

export const Route = createFileRoute("/compare_/autogroup")({
  component: AutogroupPage,
});

/** The Autogroup page, under Compare in the sidebar. */
function AutogroupPage() {
  return (
    <Page
      title="Autogroup"
      description="Asks an LLM which photos are alternatives of the same shot, then puts them in compare groups."
    >
      <AutogroupCard />
    </Page>
  );
}
