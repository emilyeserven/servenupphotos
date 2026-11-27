import { createFileRoute } from "@tanstack/react-router";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { PrintQuality } from "@/components/printing/print-quality-page";

/** The Print Quality page's search: the photo being checked, by its file name. */
interface PrintingSearch {
  photo?: string;
}

export const Route = createFileRoute("/printing")({
  component: PrintingRoute,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): PrintingSearch => ({
    photo: typeof search.photo === "string" && search.photo ? search.photo : undefined,
  }),
});

/** The Print Quality page, under Printing in the sidebar: how clear a photo prints at a size. */
function PrintingRoute() {
  const { photo } = Route.useSearch();
  return (
    <Page
      wide
      title="Print Quality"
      description="How clear a photo will be printed at a size, from its original's pixels per inch: 300 and up is excellent, 200 good, 150 fair, and anything lower poor."
    >
      <GitHubGate>{() => <PrintQuality chosen={photo} />}</GitHubGate>
    </Page>
  );
}
