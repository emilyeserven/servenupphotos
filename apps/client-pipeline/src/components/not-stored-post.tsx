import { useMutation } from "@tanstack/react-query";
import { BanIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type NotStoredPost,
  deleteNotStoredMutation,
  notStoredPosts,
  saveNotStoredMutation,
} from "@/api/not-stored";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { longDayFormat, parseIsoDate } from "@/lib/calendar";
import { notStoredByDay } from "@/lib/not-stored";
import { useCombinedData } from "@/stores/combined-data";

/** Each day's Not Stored post, by day, with the changes not committed yet. */
export function useNotStored(): Map<string, NotStoredPost> {
  const { data } = useCombinedData();
  return useMemo(() => notStoredByDay(notStoredPosts(data)), [data]);
}

/**
 * What a Not Stored post shows in place of a photo, on a calendar day or a feed tile: a dashed box
 * marked "NOT STORED", with its note unless compact (a calendar day has no room for it).
 */
export function NotStoredFace({ note, compact }: { note: string; compact?: boolean }) {
  return (
    <span className="bg-muted/60 text-muted-foreground flex size-full flex-col items-center justify-center gap-1 border-2 border-dashed p-1 text-center">
      <BanIcon className="size-4 shrink-0" aria-hidden />
      <span className="text-[9px] font-semibold tracking-wide sm:text-[10px]">NOT STORED</span>
      {!compact && note && <span className="line-clamp-2 text-[10px]">{note}</span>}
    </span>
  );
}

/** A calendar day's Not Stored post, which opens the day to change its note or remove it. */
export function NotStoredDay({
  post,
  label,
  onOpen,
}: {
  post: NotStoredPost;
  label: string;
  onOpen: () => void;
}) {
  const title = post.note ? `Not stored: ${post.note}` : "Not stored";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="size-full"
      aria-label={`${label}: ${title}. Change or remove`}
      title={title}
    >
      <NotStoredFace note={post.note} compact />
    </button>
  );
}

/**
 * The picker's button for an empty day: marks it as posted to Instagram with a photo that isn't in
 * the portfolio, so it keeps its place in the feed.
 */
export function MarkNotStoredButton({ day, onDone }: { day: string; onDone: () => void }) {
  const save = useMutation(saveNotStoredMutation);
  return (
    <DialogFooter className="items-center">
      {save.error && <p className="text-destructive text-sm">{save.error.message}</p>}
      <Button
        variant="outline"
        disabled={save.isPending}
        title="Something went up on Instagram this day, but its photo isn't in the portfolio"
        onClick={() => save.mutate({ id: day, day, note: "" }, { onSuccess: onDone })}
      >
        <BanIcon />
        Mark as Not Stored
      </Button>
    </DialogFooter>
  );
}

interface NotStoredDialogProps {
  /** The day's Not Stored post, or undefined when the dialog is closed. */
  post: NotStoredPost | undefined;
  onClose: () => void;
}

/** A Not Stored day's own dialog: its note, and a button that frees the day again. */
export function NotStoredDialog({ post, onClose }: NotStoredDialogProps) {
  return (
    <Dialog open={post !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {post && <NotStoredForm key={post.day} post={post} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

/** Saving a Not Stored post's note, and removing the post, with whether either is going and why one failed. */
function useNotStoredChanges() {
  const save = useMutation(saveNotStoredMutation);
  const remove = useMutation(deleteNotStoredMutation);
  return {
    save,
    remove,
    busy: save.isPending || remove.isPending,
    error: save.error ?? remove.error,
  };
}

function NotStoredForm({ post, onClose }: { post: NotStoredPost; onClose: () => void }) {
  const [note, setNote] = useState(post.note);
  const { save, remove, busy, error } = useNotStoredChanges();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{longDayFormat.format(parseIsoDate(post.day))}</DialogTitle>
        <DialogDescription>
          Not stored: something went up on Instagram this day, but its photo isn&apos;t in the
          portfolio. It keeps its place in the Social Feed and its rows.
        </DialogDescription>
      </DialogHeader>
      <Input
        placeholder="What was posted (optional)"
        aria-label="Note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {error && <p className="text-destructive text-sm">{error.message}</p>}
      <DialogFooter>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => remove.mutate(post.id, { onSuccess: onClose })}
        >
          Remove Not Stored
        </Button>
        <Button
          disabled={busy || note.trim() === post.note}
          onClick={() => save.mutate({ ...post, note: note.trim() }, { onSuccess: onClose })}
        >
          Save note
        </Button>
      </DialogFooter>
    </>
  );
}
