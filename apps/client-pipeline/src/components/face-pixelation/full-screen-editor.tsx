import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** The parts of the face editor, laid out by whichever view shows them. */
export interface EditorParts {
  toolbar: ReactNode;
  notes: ReactNode;
  preview: ReactNode;
  list: ReactNode;
  actions: ReactNode;
}

interface FullScreenEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parts: EditorParts;
}

/**
 * The face editor filling the window: the photo as large as fits on the left, and the areas with
 * the save buttons in a column on the right (below it on a narrow window). It edits the same areas
 * as the card, so closing it keeps every change.
 */
export function FullScreenEditor({ open, onOpenChange, parts }: FullScreenEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none p-4 text-sm sm:max-w-none">
        <DialogHeader className="pr-10">
          <DialogTitle>Pixelate faces</DialogTitle>
          <DialogDescription>
            Drag on the photo to draw an area. Esc or the close button goes back to the Photo page,
            keeping every change.
          </DialogDescription>
        </DialogHeader>
        {parts.toolbar}
        {parts.notes}
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[1fr_24rem] lg:overflow-hidden">
          <div className="flex items-start justify-center lg:min-h-0">{parts.preview}</div>
          <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto">
            {parts.list}
            {parts.actions}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
