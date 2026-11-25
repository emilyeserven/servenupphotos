import type { DragEvent } from "react";

/** A page or spread dragged on the Book tab, as its unit's ID. */
export const BOOK_UNIT_DRAG_TYPE = "application/x-photo-book-unit";

/** Starts dragging the page or spread with ID id. */
export function dragUnit(event: DragEvent, id: string) {
  event.dataTransfer.setData(BOOK_UNIT_DRAG_TYPE, id);
  event.dataTransfer.effectAllowed = "move";
}
