import { ChevronLeftIcon, ChevronRightIcon, MaximizeIcon, MinimizeIcon } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PageLook } from "@/components/photo-book/page-actions";
import { pageName } from "@/components/photo-book/page-types";
import { UnitSheets, sheetsAspect } from "@/components/photo-book/unit-sheets";
import { Button } from "@/components/ui/button";
import { type BookView, isInsideCover } from "@/lib/photo-book-order";
import { cn } from "@/lib/utils";
import { EmptyNote } from "@portfolio/components/empty-note";

interface BookPreviewProps {
  views: BookView[];
  /** The view shown, 0 first. */
  at: number;
  onAt: (at: number) => void;
  look: PageLook;
  /** How many pages the printed book has, blank placeholders too. */
  total: number;
  previewMode: boolean;
  onPreviewMode: (on: boolean) => void;
}

/**
 * The book's preview: the two facing pages shown, in the book's shape, as large as fits, with
 * controls under it to page through the book and to turn Preview Mode on or off. In Preview Mode
 * it covers the whole window, with nothing around it, so the pages are as large as they can be.
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
  return (
    <PreviewFrame previewMode={previewMode} ratio={sheetsAspect(view.pages, look)}>
      <UnitSheets pages={view.pages} look={look} className="gap-px" />
      <PreviewControls {...props} view={view} />
    </PreviewFrame>
  );
}

/**
 * Around the preview: as wide as its pages at its height, 52vh; in Preview Mode, over the whole
 * window on the body, so nothing on the page around it can clip or cover it, the pages taking all
 * of its height but the control strip's.
 */
function PreviewFrame(props: { previewMode: boolean; ratio: number; children: ReactNode }) {
  const { previewMode, ratio, children } = props;
  const tall = previewMode ? "(100vh - 5rem)" : "52vh";
  const frame = (
    <div
      className={cn(
        "flex flex-col items-center gap-3",
        previewMode && "bg-background fixed inset-0 z-50 justify-center p-4",
      )}
    >
      <div className="flex w-full flex-col gap-3" style={{ maxWidth: `calc(${ratio} * ${tall})` }}>
        {children}
      </div>
    </div>
  );
  return previewMode ? createPortal(frame, document.body) : frame;
}

/**
 * "Pages 2–3 of 12 · Spotlight + Blank page": view at shows pages 2 × at and the one after, page 1
 * facing the inside front cover and the last page the inside back cover.
 */
function viewText(view: BookView, at: number, total: number): string {
  const first = Math.max(1, 2 * at);
  const last = Math.min(total, 2 * at + 1);
  const pages = first === last ? `Page ${first}` : `Pages ${first}–${last}`;
  const names = view.pages.filter((page) => !isInsideCover(page)).map(pageName);
  return `${pages} of ${total} · ${names.join(" + ")}`;
}

/**
 * The control strip under the preview, as wide as the pages: Previous at its left end and Next at
 * its right, so they stay put while paging; between them where the preview is in the book, and
 * Preview Mode.
 */
function PreviewControls(props: BookPreviewProps & { view: BookView }) {
  const { views, at, onAt, total, previewMode, onPreviewMode, view } = props;
  const ModeIcon = previewMode ? MinimizeIcon : MaximizeIcon;
  return (
    <div className="flex w-full items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        aria-label="Previous pages"
        disabled={at === 0}
        onClick={() => onAt(at - 1)}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-center text-sm">
        {viewText(view, at, total)}
      </span>
      <Button
        size="sm"
        variant={previewMode ? "secondary" : "outline"}
        onClick={() => onPreviewMode(!previewMode)}
      >
        <ModeIcon />
        {previewMode ? "Leave Preview Mode" : "Preview Mode"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        aria-label="Next pages"
        disabled={at >= views.length - 1}
        onClick={() => onAt(at + 1)}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
