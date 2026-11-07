import { createFileRoute } from "@tanstack/react-router";
import { AltTextCard } from "@/components/alt-text/alt-text-card";
import { CardPage } from "@/components/update-data/card-page";

export const Route = createFileRoute("/alt-text")({
  component: AltTextPage,
});

/** The Alt Text page, under Photo in the sidebar. */
function AltTextPage() {
  return (
    <CardPage
      title="Alt Text"
      description="Asks an LLM to describe photos without alt text, then reviews the descriptions before they're saved."
    >
      <AltTextCard />
    </CardPage>
  );
}
