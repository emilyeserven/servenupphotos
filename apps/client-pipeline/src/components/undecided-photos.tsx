import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, CircleHelpIcon, ImageIcon, PencilIcon, Undo2Icon } from "lucide-react";
import type { InFlightFile, InFlightImages } from "@/api/photos";
import { squareThumbnailUrl } from "@/api/versions";
import { Button } from "@/components/ui/button";
import { titleOf } from "@/lib/drafts";
import { UNDECIDED } from "@/lib/undecided";
import { useLocalEditsStore } from "@/stores/local-edits";

/** Sets or clears the photo's `undecided` mark, as a local edit until Commit. */
function useSetUndecided() {
  const setField = useLocalEditsStore((s) => s.setField);
  return (file: InFlightFile, undecided: boolean) =>
    setField(UNDECIDED, [
      {
        path: file.path,
        before: (file.data ?? {}) as Record<string, unknown>,
        // Left out (null) rather than false, so a photo moved back is as it was.
        value: undecided ? true : null,
      },
    ]);
}

/** Whether the photo can go in the Undecided queue: its JSON was read, it's kept, and it has no title. */
function canMoveToUndecided(file: InFlightFile): boolean {
  return !file.error && file.status !== "removed" && titleOf(file.data) === undefined;
}

/**
 * A button that moves an untitled photo to the Undecided queue, out of the list of photos in
 * flight, until it gets a title or is moved back. Nothing for a photo with a title.
 */
export function MoveToUndecided({ file }: { file: InFlightFile }) {
  const setUndecided = useSetUndecided();
  if (!canMoveToUndecided(file)) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      title="Set this photo aside until you decide on it. It stays saved, as a draft."
      onClick={() => setUndecided(file, true)}
    >
      <CircleHelpIcon />
      Undecided
    </Button>
  );
}

/**
 * The Undecided queue, a panel collapsed to its count until it's opened: the untitled photos set
 * aside from the list of photos in flight, each with Edit, to name it on the Photo page, and Move
 * back. Nothing while it's empty.
 */
export function UndecidedQueue({
  files,
  images,
}: {
  files: InFlightFile[];
  images: InFlightImages;
}) {
  if (files.length === 0) return null;
  return (
    <details className="group bg-card rounded-xl border shadow-sm">
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 rounded-xl px-6 py-4 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
        <span className="font-semibold">Undecided</span>
        <span className="text-muted-foreground text-sm">
          {files.length} {files.length === 1 ? "photo" : "photos"} set aside
        </span>
      </summary>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <p className="text-muted-foreground text-sm">
          Untitled photos set aside. They stay saved as drafts the portfolio doesn&apos;t show, and
          Next untitled photo skips them. Giving one a title, or moving it back, returns it to the
          list.
        </p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((file) => (
            <UndecidedPhoto key={file.path} file={file} imageUrl={images.byPath[file.path]?.url} />
          ))}
        </ul>
      </div>
    </details>
  );
}

/** One photo in the queue: its Square Thumbnail, file name, Edit and Move back. */
function UndecidedPhoto({ file, imageUrl }: { file: InFlightFile; imageUrl?: string }) {
  const setUndecided = useSetUndecided();
  const name = file.path.split("/").pop() ?? file.path;
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <span className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-md border">
        {imageUrl ? (
          <img
            src={squareThumbnailUrl(imageUrl)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="text-muted-foreground size-5" />
        )}
      </span>
      <span className="truncate text-xs" title={name}>
        {name}
      </span>
      <span className="flex flex-wrap gap-1">
        {imageUrl && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/exif" search={{ edit: file.path }}>
              <PencilIcon />
              Edit
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setUndecided(file, false)}>
          <Undo2Icon />
          Move back
        </Button>
      </span>
    </li>
  );
}
