import { type DragEvent, useState } from "react";

/**
 * Drag handlers that take what's dropped here as the drag's `type` data, and whether something of
 * that type is being dragged over it. Moving onto the target's own children isn't leaving it.
 */
export function useDropTarget(type: string, onDropData: (data: string) => void) {
  const [over, setOver] = useState(false);
  const handlers = {
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(type)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setOver(true);
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
      const data = event.dataTransfer.getData(type);
      if (data !== "") onDropData(data);
    },
  };
  return { over, handlers };
}
