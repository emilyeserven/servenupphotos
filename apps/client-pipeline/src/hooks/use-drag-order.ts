import { type DragEvent, useState } from "react";

/**
 * The tile being dragged in a list of tiles, by its place, and the handlers that move it to the
 * place of each tile it passes over with move, so the list shows the new order as it's dragged.
 */
export function useDragOrder(move: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  return {
    dragging,
    start: (place: number, event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      // Firefox only starts a drag that carries data.
      event.dataTransfer.setData("text/plain", String(place));
      setDragging(place);
    },
    enter: (place: number) => {
      if (dragging === null || dragging === place) return;
      move(dragging, place);
      setDragging(place);
    },
    end: () => setDragging(null),
  };
}

/** A list's drag to reorder, from useDragOrder. */
export type DragOrder = ReturnType<typeof useDragOrder>;
