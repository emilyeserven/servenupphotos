import { PlusIcon } from "lucide-react";
import { AddPageButton } from "@/components/photo-book/add-page-button";
import { Button } from "@/components/ui/button";
import type { PageLayout } from "@/lib/photo-book";
import type { InsertPoint } from "@/lib/photo-book-edit";
import type { LayoutChoice } from "@/lib/photo-book-layouts";

/** What Edit mode needs to insert pages on the preview. */
export interface PageInserting {
  /** Where on the pages shown a page can be inserted. */
  points: InsertPoint[];
  layouts: LayoutChoice[];
  /** Makes a new page with layout and puts it in the book at place at. */
  onInsert: (layout: PageLayout, at: number) => void;
}

/** What each edge's button says it inserts, by the edge: before, between or after the pages shown. */
const EDGE_LABELS = [
  "Insert a page before these",
  "Insert a page between these",
  "Insert a page after these",
];

/**
 * Round **+** buttons over the edges of the pages the preview shows, at its left edge, its gutter
 * and its right edge, wherever a page can go; each asks for the new page's layout and inserts it
 * there in the book.
 */
export function InsertPagePoints({ points, layouts, onInsert }: PageInserting) {
  return points.map((point) => (
    <div
      key={point.edge}
      className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${point.edge * 50}%` }}
    >
      <AddPageButton
        layouts={layouts}
        onAdd={(layout) => onInsert(layout, point.at)}
        trigger={
          <Button
            size="icon"
            variant="secondary"
            aria-label={EDGE_LABELS[point.edge]}
            title={EDGE_LABELS[point.edge]}
            className="rounded-full shadow-md"
          >
            <PlusIcon />
          </Button>
        }
      />
    </div>
  ));
}
