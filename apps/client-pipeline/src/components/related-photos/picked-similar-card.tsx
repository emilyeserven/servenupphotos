import { useMemo } from "react";
import { useSavedPhotos } from "@/components/saved-photo-picker";
import { PickedSimilarFields } from "@/components/related-photos/picked-similar-fields";
import { foundIds, type Pick, photosById, savedPhotoId } from "@/components/related-photos/picks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface PickedSimilarCardProps {
  /** The photo's JSON as last saved, for its ID and the related photos found for it. */
  saved: Record<string, unknown>;
  /** The photos picked so far, in order, with their notes. */
  value: Pick[];
  onChange: (picks: Pick[]) => void;
  /** Saving is under way, so changing it now would not change the file. */
  disabled: boolean;
}

/**
 * The Photo page's More like this card: the photos picked by hand to show first in the
 * portfolio's More like this drawer, saved as the JSON's `pickedSimilar` with the photo's other
 * changes.
 */
export function PickedSimilarCard({ saved, value, onChange, disabled }: PickedSimilarCardProps) {
  const { photos: all, pending } = useSavedPhotos();
  const photos = useMemo(() => all.filter((photo) => savedPhotoId(photo) !== undefined), [all]);
  const byId = useMemo(() => photosById(photos), [photos]);
  const self = typeof saved.id === "number" ? saved.id : undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle>More like this</CardTitle>
        <CardDescription>
          The photos the portfolio&apos;s More like this drawer shows first for this one, ahead of
          the ones Find related photos found. Saving changes writes them into the JSON&apos;s{" "}
          <code>pickedSimilar</code>, and their notes, shown to the right of each photo, into{" "}
          <code>pickedSimilarNotes</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pending ? (
          <Spinner className="size-6" />
        ) : (
          <fieldset disabled={disabled} className="contents">
            <PickedSimilarFields
              self={self}
              found={foundIds(saved)}
              picks={value}
              onChange={onChange}
              photos={photos}
              byId={byId}
            />
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
