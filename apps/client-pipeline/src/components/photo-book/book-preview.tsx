import { ChevronLeftIcon, ChevronRightIcon, MaximizeIcon, MinimizeIcon } from "lucide-react";
import type { PageLook } from "@/components/photo-book/page-actions";
import { pageName } from "@/components/photo-book/page-types";
import { UnitSheets, sheetsAspect } from "@/components/photo-book/unit-sheets";
import { Button } from "@/components/ui/button";
import type { BookView } from "@/lib/photo-book-order";
import { EmptyNote } from "@portfolio/components/empty-note";

interface BookPreviewProps {
  views: BookView[];
  /** The view shown, 0 first. */
  at: number;
  onAt: (at: number) => void;
  look: PageLook;
  /** Each page's number in the book, by its ID. */
  numbers: Map<string, number>;
  previewMode: boolean;
  onPreviewMode: (on: boolean) => void;
}

/**
 * The book's preview: the page or spread shown, in the book's shape, as large as fits, with
 * controls under it to page through the book and to turn Preview Mode on or off.
 */
export function BookPreview(props: BookPreviewProps) {
  const { views, at, look, previewMode } = props;
  const view = views[at];
  if (!view) {
    return (
      <EmptyNote>
        No pages in the book yet. Drag pages and spreads from the drawer below into Used page
        spreads, or add them with their Add button.
      </EmptyNote>
    );
  }
  const ratio = sheetsAspect(view.pages, look);
  const tall = previewMode ? "80vh" : "52vh";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full" style={{ maxWidth: `calc(${ratio} * ${tall})` }}>
        <UnitSheets pages={view.pages} look={look} className="gap-px" />
      </div>
      <PreviewControls {...props} view={view} />
    </div>
  );
}

/** "Pages 3–4 of 12 · Spotlight + Chapter one". */
function viewText(view: BookView, numbers: Map<string, number>, total: number): string {
  const ns = view.pages.flatMap((page) => numbers.get(page.id) ?? []);
  const pages = ns.length > 1 ? `Pages ${ns[0]}–${ns.at(-1)}` : `Page ${ns[0]}`;
  return `${pages} of ${total} · ${view.pages.map(pageName).join(" + ")}`;
}

/** Previous and Next, where the preview is in the book, and Preview Mode. */
function PreviewControls(props: BookPreviewProps & { view: BookView }) {
  const { views, at, onAt, numbers, previewMode, onPreviewMode, view } = props;
  const ModeIcon = previewMode ? MinimizeIcon : MaximizeIcon;
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2">
      <Button
        size="sm"
        variant="outline"
        aria-label="Previous pages"
        disabled={at === 0}
        onClick={() => onAt(at - 1)}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="text-muted-foreground min-w-0 text-center text-sm">
        {viewText(view, numbers, numbers.size)}
      </span>
      <Button
        size="sm"
        variant="outline"
        aria-label="Next pages"
        disabled={at >= views.length - 1}
        onClick={() => onAt(at + 1)}
      >
        <ChevronRightIcon />
      </Button>
      <Button
        size="sm"
        variant={previewMode ? "secondary" : "outline"}
        onClick={() => onPreviewMode(!previewMode)}
      >
        <ModeIcon />
        {previewMode ? "Leave Preview Mode" : "Preview Mode"}
      </Button>
    </div>
  );
}
