import { ImageOffIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { UnselectedWinners } from "@/components/compare/unselected-winners";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCompareEdits } from "@/hooks/use-compare-groups";
import { useDiscardImages } from "@/hooks/use-discard-images";
import { type ComparePhoto, comparePhotoName } from "@/lib/compare-groups";
import { offlineImageUrl, squareImages } from "@/lib/offline-thumbnails";
import { UNSELECTED_IMAGES, type Unselected, unselectedOf } from "@/lib/unselected";

/**
 * Unselected Photos: the photos that weren't chosen when a compare group was finished, each with why,
 * the photos chosen instead, what's left of it in R2, and buttons to delete more of it or move it
 * back. Nothing while there are none.
 */
export function UnselectedPhotos({
  unselected,
  photos,
}: {
  /** The unselected photos. */
  unselected: ComparePhoto[];
  /** Every photo that can be compared, to find and pick winners from. */
  photos: ComparePhoto[];
}) {
  if (unselected.length === 0) return null;
  return (
    <section id="unselected" className="flex flex-col gap-3">
      <header>
        <h2 className="text-xl font-semibold">Unselected Photos</h2>
        <p className="text-muted-foreground text-sm">
          {unselected.length === 1 ? "1 photo" : `${unselected.length} photos`} not chosen in a
          compare group. Commit leaves them off the portfolio.
        </p>
      </header>
      <ul className="grid gap-4 lg:grid-cols-2">
        {unselected.map((photo) => (
          <li key={photo.file.path}>
            <UnselectedCard photo={photo} photos={photos} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnselectedCard({ photo, photos }: { photo: ComparePhoto; photos: ComparePhoto[] }) {
  const unselected = unselectedOf(photo)!;
  const { setUnselected } = useCompareEdits();
  const update = (change: Partial<Unselected>) =>
    setUnselected(photo, { ...unselected, ...change });
  return (
    <article className="bg-card flex h-full flex-col gap-4 rounded-xl border p-4 sm:flex-row">
      <SmallImage photo={photo} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <UnselectedHeading photo={photo} unselected={unselected} />
        <ReasonField
          key={unselected.reason}
          reason={unselected.reason}
          onSave={(reason) => update({ reason })}
        />
        <UnselectedWinners
          winners={unselected.winners}
          photos={photos}
          onChange={(winners) => update({ winners })}
        />
        <div className="mt-auto flex flex-wrap gap-2">
          <DeleteImages photo={photo} unselected={unselected} onDeleted={update} />
          <Button variant="ghost" size="sm" onClick={() => setUnselected(photo, null)}>
            <Undo2Icon />
            Move back
          </Button>
        </div>
      </div>
    </article>
  );
}

/**
 * The photo's Small version from the offline copy, or else its Square Thumbnail; a sign when
 * neither loads, such as once it's deleted from R2 and was never kept offline.
 */
function SmallImage({ photo }: { photo: ComparePhoto }) {
  const [failed, setFailed] = useState(false);
  const src = smallUrl(photo);
  if (!src || failed)
    return (
      <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full shrink-0 flex-col items-center justify-center gap-1 self-start rounded-md border text-xs sm:w-40">
        <ImageOffIcon className="size-6" aria-hidden />
        No image
      </div>
    );
  return (
    <img
      src={src}
      alt={comparePhotoName(photo)}
      loading="lazy"
      onError={() => setFailed(true)}
      className="bg-muted aspect-square w-full shrink-0 self-start rounded-md border object-contain sm:w-40"
    />
  );
}

/** The photo's Small version as its JSON saves it, when it does. */
function savedSmall(data: Record<string, unknown>): string | undefined {
  const small = (data.images as Record<string, unknown> | undefined)?.small;
  return typeof small === "string" && small ? small : undefined;
}

/** The photo's Small version from the offline copy, or else its Square Thumbnail. */
function smallUrl(photo: ComparePhoto): string | undefined {
  const small = savedSmall(photo.data);
  if (small) return offlineImageUrl(small);
  return photo.imageUrl && squareImages(photo.data, photo.imageUrl)?.square;
}

function UnselectedHeading({ photo, unselected }: { photo: ComparePhoto; unselected: Unselected }) {
  const name = comparePhotoName(photo);
  return (
    <div className="min-w-0">
      <h3 className="truncate font-medium" title={name}>
        {name}
      </h3>
      <p className="text-muted-foreground truncate font-mono text-xs">
        {photo.file.path.split("/").pop()}
      </p>
      <p className="text-muted-foreground text-xs">
        Not chosen in “{unselected.group}” on {unselected.date}.{" "}
        {UNSELECTED_IMAGES[unselected.images] ?? UNSELECTED_IMAGES.kept}.
      </p>
    </div>
  );
}

/** Why the photo wasn't chosen, saved as a local edit when the box loses focus. */
function ReasonField({ reason, onSave }: { reason: string; onSave: (reason: string) => void }) {
  const [text, setText] = useState(reason);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">Why it wasn&apos;t chosen</span>
      <Textarea
        value={text}
        rows={2}
        placeholder="Such as: softer focus, and the winner's framing is cleaner"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== reason && onSave(text.trim())}
      />
    </label>
  );
}

/** What deleting more of the photo from R2 leaves: only its Small versions, then nothing. */
function nextKeep(unselected: Unselected): "small" | "deleted" | undefined {
  if (unselected.images === "deleted") return undefined;
  return unselected.images === "small" ? "deleted" : "small";
}

const DELETE_LABELS = {
  small: "Keep only Small versions in R2",
  deleted: "Delete the rest from R2",
};

/**
 * Deleting more of the photo from R2 to leave keep, recording what's left once it's done, and why
 * it couldn't be when it can't.
 */
function useDeleteMore(
  photo: ComparePhoto,
  keep: "small" | "deleted",
  onDeleted: (change: Partial<Unselected>) => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const discard = useDiscardImages();
  const run = async () => {
    setBusy(true);
    const [failure] = await discard([photo], keep);
    setBusy(false);
    setError(failure?.message);
    if (!failure) onDeleted({ images: keep });
  };
  return { busy, error, run };
}

/**
 * Deletes more of the photo from R2, after a second click: the original and larger versions while
 * it's all there, then the rest. Nothing once it's deleted.
 */
function DeleteImages({
  photo,
  unselected,
  onDeleted,
}: {
  photo: ComparePhoto;
  unselected: Unselected;
  onDeleted: (change: Partial<Unselected>) => void;
}) {
  const keep = nextKeep(unselected);
  if (!keep) return null;
  return <DeleteMoreButton photo={photo} keep={keep} onDeleted={onDeleted} />;
}

/** How the delete button looks: what it deletes, or asking to be sure after the first click. */
function deleteLook(confirming: boolean, keep: "small" | "deleted") {
  if (confirming) return { variant: "destructive" as const, label: "Delete for good?" };
  return { variant: "outline" as const, label: DELETE_LABELS[keep] };
}

function DeleteMoreButton({
  photo,
  keep,
  onDeleted,
}: {
  photo: ComparePhoto;
  keep: "small" | "deleted";
  onDeleted: (change: Partial<Unselected>) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useDeleteMore(photo, keep, onDeleted);
  const click = () =>
    confirming ? void run().then(() => setConfirming(false)) : setConfirming(true);
  const look = deleteLook(confirming, keep);
  return (
    <>
      <Button variant={look.variant} size="sm" disabled={busy} onClick={click}>
        {busy ? <Spinner /> : <Trash2Icon />}
        {look.label}
      </Button>
      <DeleteError error={error} />
    </>
  );
}

function DeleteError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-destructive w-full text-xs">{error}</p>;
}
