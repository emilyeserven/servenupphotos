import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import type { FaceEditorState } from "@/components/face-pixelation/use-face-editor";
import type { PixelateSave } from "@/components/face-pixelation/use-pixelate-save";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { FaceBox } from "@/lib/face-boxes";

interface PixelateActionsProps {
  editor: FaceEditorState;
  saved: FaceBox[];
  pixelate: PixelateSave;
  locked: boolean;
}

/** Remakes the versions with the faces, or puts back the saved ones, and says how that went. */
export function PixelateActions({ editor, saved, pixelate, locked }: PixelateActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SaveButton editor={editor} saved={saved} pixelate={pixelate} locked={locked} />
        <UndoButtons editor={editor} saved={saved} locked={locked} />
      </div>
      <p className="text-muted-foreground text-xs">
        Remakes every version and the Square Thumbnail in R2 and saves the photo's JSON. The
        original JPEG in R2 isn't changed.
      </p>
      <SaveNote
        pixelate={pixelate}
        done={pixelate.mutation.isSuccess && !editor.changed}
        pixelated={editor.faces.length > 0}
      />
    </div>
  );
}

/** Puts back the saved faces, when they've changed, and removes every box, when there are any. */
function UndoButtons({ editor, saved, locked }: Omit<PixelateActionsProps, "pixelate">) {
  return (
    <>
      {editor.changed && (
        <Button variant="outline" size="sm" onClick={editor.reset} disabled={locked}>
          <RotateCcwIcon />
          {saved.length > 0 ? "Back to the saved faces" : "Start over"}
        </Button>
      )}
      {editor.faces.length > 0 && (
        <Button variant="ghost" size="sm" onClick={editor.clear} disabled={locked}>
          <Trash2Icon />
          Remove all
        </Button>
      )}
    </>
  );
}

/** Whether saving faces would remake the versions without any pixelation, after there was some. */
function stopsPixelating(faces: FaceBox[], saved: FaceBox[]): boolean {
  return faces.length === 0 && saved.length > 0;
}

/** Pixelates every version, or remakes them without pixelation once every box is removed. */
function SaveButton({ editor, saved, pixelate, locked }: PixelateActionsProps) {
  const label = stopsPixelating(editor.faces, saved)
    ? "Remake versions without pixelation"
    : "Pixelate every version";
  const disabled = locked || !editor.changed;
  return (
    <Button size="sm" onClick={() => pixelate.mutation.mutate(editor.faces)} disabled={disabled}>
      {pixelate.mutation.isPending && <Spinner />}
      {label}
    </Button>
  );
}

interface SaveNoteProps {
  pixelate: PixelateSave;
  /** The faces shown are the ones just saved. */
  done: boolean;
  pixelated: boolean;
}

/** Why pixelating failed, or what it did once it's done. */
function SaveNote({ pixelate, done, pixelated }: SaveNoteProps) {
  if (pixelate.mutation.isError) return <SaveError pixelate={pixelate} />;
  if (!done) return null;
  return (
    <p className="text-muted-foreground text-sm">
      Every version is remade {pixelated ? "with these faces pixelated" : "without pixelation"}, and
      the photo's JSON points at them.
    </p>
  );
}

/** Why pixelating failed, and whether the versions were remade before it did. */
function SaveError({ pixelate: { mutation, remadeOnly } }: { pixelate: PixelateSave }) {
  const prefix = remadeOnly ? "The versions are remade, but saving the photo's JSON failed: " : "";
  return (
    <p role="alert" className="text-destructive text-sm">
      {prefix + (mutation.error?.message ?? "")}
    </p>
  );
}
