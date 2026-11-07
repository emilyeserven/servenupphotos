import { useMemo, useState } from "react";
import { useSavedPhotos } from "@/components/saved-photo-picker";
import { PhotoChoiceGrid } from "@/components/similar-photos/photo-choice-grid";
import { PickedEditor } from "@/components/similar-photos/picked-editor";
import { photoId, photosById } from "@/components/similar-photos/similar-ids";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/**
 * Pick by hand: choose a photo, then the photos its More like this drawer shows first, ahead of
 * the ones Find Similar Photos found.
 */
export function PickSimilarCard() {
  const { photos: saved, pending } = useSavedPhotos();
  const photos = useMemo(() => saved.filter((photo) => photoId(photo) !== undefined), [saved]);
  const byId = useMemo(() => photosById(photos), [photos]);
  const [chosenPath, setChosenPath] = useState<string>();
  const chosen = photos.find((photo) => photo.path === chosenPath);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick similar photos by hand</CardTitle>
        <CardDescription>
          Choose a photo, then the photos you want its More like this drawer to show first. Picks
          take precedence over the ones found automatically, which fill the rest of the drawer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {pending ? (
          <Spinner className="size-6" />
        ) : (
          <PhotoChoiceGrid
            photos={photos}
            chosen={chosenPath}
            onChoose={(photo) => setChosenPath(photo.path)}
          />
        )}
        {chosen && <PickedEditor key={chosen.path} photo={chosen} photos={photos} byId={byId} />}
      </CardContent>
    </Card>
  );
}
