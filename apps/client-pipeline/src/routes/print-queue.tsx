import { createFileRoute } from "@tanstack/react-router";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { PrintQueue } from "@/components/printing/print-queue-page";

export const Route = createFileRoute("/print-queue")({
  component: PrintQueueRoute,
  staticData: { wide: true },
});

/** The Print Queue page, under Printing in the sidebar: the photos in the album chosen as the queue. */
function PrintQueueRoute() {
  return (
    <Page
      wide
      title="Print Queue"
      description="The photos waiting to be printed: one album, chosen here, is the print queue. Each photo shows how clear it prints at the size picked."
    >
      <GitHubGate>{() => <PrintQueue />}</GitHubGate>
    </Page>
  );
}
