import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcwIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  type InFlightFileRead,
  photosInFlightQuery,
  publishedPhotosQuery,
  updateInFlightMutation,
} from "@/api/photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type ReEditDraft, savedReEdit, withReEdit } from "@/lib/re-edit";

/** Whether the photo can be marked: its JSON was read and it isn't being removed. */
function canReEdit(file: InFlightFileRead): boolean {
  return !file.error && file.status !== "removed";
}

/**
 * Saves the photo's re-edit mark, as the Photo page's Re-edit card does, as a change waiting for
 * Commit, then reads the photos in flight again so the mark shows.
 */
function useSaveReEdit(file: InFlightFileRead, onSaved: () => void) {
  const queryClient = useQueryClient();
  const update = useMutation(updateInFlightMutation);
  const save = (draft: ReEditDraft) =>
    update.mutate(
      { path: file.path, data: withReEdit((file.data ?? {}) as Record<string, unknown>, draft) },
      {
        onSuccess: (result) => {
          onSaved();
          void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
          // A photo already in the portfolio is in the pull request after its first save.
          if (result.changed)
            void queryClient.invalidateQueries({ queryKey: publishedPhotosQuery.queryKey });
        },
      },
    );
  return { save, isPending: update.isPending, error: update.error };
}

/** How the button looks: filled in when the photo is marked, faint when it isn't. */
const LOOKS = {
  marked: {
    variant: "secondary" as const,
    className: undefined,
    title: "Change the re-edit note, or take the mark off",
  },
  unmarked: {
    variant: "ghost" as const,
    className: "text-muted-foreground",
    title: "Mark it to edit again",
  },
};

/** How the button looks for the saved note, which is undefined when the photo isn't marked. */
function lookOf(reason: string | undefined) {
  return LOOKS[reason === undefined ? "unmarked" : "marked"];
}

/**
 * A button that marks the photo for re-editing, such as in Lightroom, with a quick note on why,
 * without leaving Photos in Flight. It saves the JSON's `reEdit` as the Photo page's Re-edit card
 * does; on a photo already marked it changes the note or takes the mark off. Nothing for a photo
 * whose JSON couldn't be read or that's being removed.
 */
export function ReEditButton({ file }: { file: InFlightFileRead }) {
  const [open, setOpen] = useState(false);
  if (!canReEdit(file)) return null;
  const reason = savedReEdit(file.data)?.reason;
  const look = lookOf(reason);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={look.variant} size="sm" className={look.className} title={look.title}>
          <RotateCcwIcon />
          Re-edit
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        {open && <ReEditForm file={file} reason={reason} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

/** The form's words, for a photo not marked yet and for one already marked. */
const WORDS = {
  unmarked: { label: "Why edit it again?", submit: "Mark for re-edit" },
  marked: { label: "Re-edit note", submit: "Save note" },
};

type SaveReEdit = ReturnType<typeof useSaveReEdit>;

/**
 * The note on why the photo needs editing again, saved with Enter or Mark for re-edit, and Take off
 * on a photo already marked. `reason` is the saved note, undefined when it isn't marked.
 */
function ReEditForm({
  file,
  reason,
  onDone,
}: {
  file: InFlightFileRead;
  reason?: string;
  onDone: () => void;
}) {
  const [note, setNote] = useState(reason ?? "");
  const save = useSaveReEdit(file, onDone);
  const marked = reason !== undefined;
  const id = `re-edit-note-${file.path}`;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.save({ marked: true, reason: note });
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        {WORDS[marked ? "marked" : "unmarked"].label}
      </label>
      <Input
        id={id}
        autoFocus
        value={note}
        placeholder="Too warm, crop the sign out, fix the horizon…"
        disabled={save.isPending}
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="text-muted-foreground text-xs">
        Optional. Saved as a change waiting for Commit; replacing the image takes the mark off.
      </p>
      <FormActions save={save} marked={marked} />
    </form>
  );
}

/** Why saving failed, if it did, then Take off on a photo already marked, and the save button. */
function FormActions({ save, marked }: { save: SaveReEdit; marked: boolean }) {
  return (
    <>
      {save.error && <p className="text-destructive text-sm">{save.error.message}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {marked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={save.isPending}
            onClick={() => save.save({ marked: false, reason: "" })}
          >
            <XIcon />
            Take off
          </Button>
        )}
        <Button type="submit" size="sm" disabled={save.isPending}>
          <RotateCcwIcon />
          {WORDS[marked ? "marked" : "unmarked"].submit}
        </Button>
      </div>
    </>
  );
}
