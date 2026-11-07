import { createFileRoute } from "@tanstack/react-router";
import { ChartColumn } from "lucide-react";
import { GraphBuilder } from "@/components/graph-builder/graph-builder";
import { SiteHomeLink } from "@/components/site-home-link";
import { useGraphWide } from "@/lib/graph-wide";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/graph")({
  component: GraphView,
});

/** The Graph page: a graph of your own making from the counts on the Numbers page. */
function GraphView() {
  const [wide, setWide] = useGraphWide();
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 py-16 sm:px-6",
        wide ? "max-w-none lg:px-10" : "max-w-5xl",
      )}
    >
      <header>
        <SiteHomeLink className="mb-1" />
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <ChartColumn className="size-8 text-muted-foreground" aria-hidden />
          Graph
        </h1>
        <p className="mt-2 text-muted-foreground">
          Make a graph of your own from the counts on the Numbers page: pick its type, what goes on
          each axis, what splits the bars or lines, and which photos it counts.
        </p>
      </header>
      <GraphBuilder wide={wide} onWideChange={setWide} />
    </div>
  );
}
