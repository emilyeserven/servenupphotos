import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoveIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { SaveSpreadImageButton } from "@/components/photo-book/book-spread-image";
import { InsertPagePoints, type PageInserting } from "@/components/photo-book/insert-page-points";
import type { PageLook } from "@/components/photo-book/page-actions";
import { pageName } from "@/components/photo-book/page-types";
import { UnitSheets, sheetsAspect } from "@/components/photo-book/unit-sheets";
import { Button } from "@/components/ui/button";
import type { PhotoBook } from "@/lib/photo-book";
import { type BookView, isInsideCover } from "@/lib/photo-book-order";
import { viewPageRange } from "@/lib/photo-book-spread-image";
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
  /** The book and the function that changes it, for Edit mode's moving photos between pages. */
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  editMode: boolean;
  onEditMode: (on: boolean) => void;
  /** Inserting pages in Edit mode. */
  inserting: PageInserting;
}

/**
 * The book's preview: the two facing pages shown, in the book's shape, as large as fits, with
 * controls under it to page through the book and to turn Edit mode and Preview Mode on or off.
 * In Edit mode, photos can be dragged from one place to another on the pages shown, moving or
 * swapping them, or in from the Photos drawer, and **+** buttons on their edges insert new pages;
 * nothing else on the pages changes there. In Preview Mode it covers the whole window, with nothing around it, so the pages are as large as they can be.
 */
export function BookPreview(props: BookPreviewProps) {
  const { views, at, look, previewMode, book, update, editMode, inserting } = props;
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
      <div className="relative">
        <UnitSheets
          pages={view.pages}
          look={look}
          editing={editMode ? { book, update } : undefined}
          className="gap-px"
        />
        {editMode && <InsertPagePoints {...inserting} />}
      </div>
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
  const { first, last } = viewPageRange(at, total);
  const pages = first === last ? `Page ${first}` : `Pages ${first}–${last}`;
  const names = view.pages.filter((page) => !isInsideCover(page)).map(pageName);
  return `${pages} of ${total} · ${names.join(" + ")}`;
}

/**
 * The control strip under the preview, as wide as the pages: Previous at its left end and Next at
 * its right, so they stay put while paging; between them where the preview is in the book, the
 * modes, and **Save as image** for the pages shown.
 */
function PreviewControls(props: BookPreviewProps & { view: BookView }) {
  const { views, at, onAt, total, view, book, look } = props;
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
      <ModeButtons {...props} />
      <SaveSpreadImageButton book={book} look={look} view={view} at={at} total={total} />
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

/** **Edit mode** (Done editing while on) and **Preview Mode** (Leave Preview Mode while on). */
function ModeButtons(props: {
  editMode: boolean;
  onEditMode: (on: boolean) => void;
  previewMode: boolean;
  onPreviewMode: (on: boolean) => void;
}) {
  return (
    <>
      <EditModeButton on={props.editMode} onChange={props.onEditMode} />
      <PreviewModeButton on={props.previewMode} onChange={props.onPreviewMode} />
    </>
  );
}

/** Turns Edit mode on, or off as Done editing. */
function EditModeButton({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Button
      size="sm"
      variant={on ? "secondary" : "outline"}
      aria-pressed={on}
      title="Drag photos between the pages shown to move or swap them"
      onClick={() => onChange(!on)}
    >
      <MoveIcon />
      {on ? "Done editing" : "Edit mode"}
    </Button>
  );
}

/** Turns Preview Mode on, or off as Leave Preview Mode. */
function PreviewModeButton({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const Icon = on ? MinimizeIcon : MaximizeIcon;
  return (
    <Button size="sm" variant={on ? "secondary" : "outline"} onClick={() => onChange(!on)}>
      <Icon />
      {on ? "Leave Preview Mode" : "Preview Mode"}
    </Button>
  );
}
