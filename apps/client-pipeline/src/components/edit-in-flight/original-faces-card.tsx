import { CheckIcon, CopyPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PhotoJson } from "@/components/edit-in-flight/photo-json";
import { OriginalCropPicker } from "@/components/edit-in-flight/original-crop-picker";
import type { UneditedOriginal } from "@/components/edit-in-flight/use-unedited-original";
import { FaceEditor } from "@/components/face-pixelation/face-pixelation-card";
import type { FaceBox } from "@/lib/face-boxes";
import { facesFromJson } from "@/lib/face-json";
import {
  type OriginalCrop,
  type OriginalEntry,
  type Size,
  cropOrMiddle,
  facesChecked,
  knownSize,
  scaledFaces,
} from "@/lib/unedited-original";

interface OriginalPartsProps {
  original: UneditedOriginal;
  entry: OriginalEntry;
  saved: PhotoJson;
  blocked: boolean;
}

/** A version of the original to draw on: its largest below full size, or its JPEG. */
function drawnVersion({ images }: OriginalEntry): string {
  const urls = [images.xlarge, images.large, images.medium, images.full];
  return urls.find((url): url is string => Boolean(url)) ?? "";
}

/** The original's own pixelated areas, as its JSON saves them, or undefined before any are. */
function ownFaces(entry: OriginalEntry): FaceBox[] | undefined {
  return facesFromJson(entry as unknown as Record<string, unknown>);
}

/** The R2 key and JPEG of the original, for the face editor. */
function editedImage({ images }: OriginalEntry) {
  return { key: String(images.key ?? ""), url: String(images.full ?? "") };
}

/**
 * The part of the original the edit shows, and pixelating faces on the original's versions,
 * starting from the photo's own areas scaled from the edit into that part.
 */
export function OriginalFacesCards(props: OriginalPartsProps) {
  const edit = knownSize(props.saved);
  const size = knownSize(props.entry);
  if (!edit || !size) {
    return (
      <p className="text-muted-foreground text-sm">
        The photo or its original has no saved size, so its crop and pixelation can&apos;t be set.
      </p>
    );
  }
  const crop = cropOrMiddle(props.entry, edit) as OriginalCrop;
  return (
    <>
      <CropCard {...props} edit={edit} size={size} crop={crop} />
      <PixelateCard {...props} edit={edit} crop={crop} />
    </>
  );
}

/** Where in the original the edit was cropped from, for the Slider and Switch and for the faces. */
function CropCard({
  original,
  entry,
  blocked,
  edit,
  size,
  crop,
}: OriginalPartsProps & { edit: Size; size: Size; crop: OriginalCrop }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The edit&apos;s crop</CardTitle>
        <CardDescription>
          The part of the original the edit shows, in the edit&apos;s shape. Drag the box to move it
          and its corner to size it. The Slider and Switch draw only this part, so the two line up,
          and the photo&apos;s pixelated areas are scaled into it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OriginalCropPicker
          key={`${String(entry.images.key)}:${JSON.stringify(crop)}`}
          src={drawnVersion(entry)}
          size={size}
          edit={edit}
          saved={crop}
          isSaved={Boolean(entry.crop)}
          onSave={original.setCrop}
          saving={original.change.isPending}
          disabled={blocked}
        />
      </CardContent>
    </Card>
  );
}

/** The photo's own areas scaled into the original's crop. */
function photoAreas(saved: PhotoJson, edit: Size, crop: OriginalCrop): FaceBox[] {
  return scaledFaces(facesFromJson(saved) ?? [], edit, crop);
}

/** Pixelating faces on the original's versions, which the portfolio needs before it shows it. */
function PixelateCard({
  original,
  entry,
  saved,
  blocked,
  edit,
  crop,
}: OriginalPartsProps & { edit: Size; crop: OriginalCrop }) {
  const own = ownFaces(entry);
  const fromPhoto = photoAreas(saved, edit, crop);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pixelate the original</CardTitle>
        <CardDescription>
          Hide faces on the original&apos;s versions, as on the photo&apos;s. It starts with the
          photo&apos;s pixelated areas scaled into the edit&apos;s crop; check them, and box any
          faces the edit cropped out. The original JPEG in R2 isn&apos;t changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CheckedNote original={original} entry={entry} saved={saved} blocked={blocked} />
        <FaceEditor
          key={`${String(entry.images.key)}:${JSON.stringify(entry.faces)}`}
          image={editedImage(entry)}
          saved={own ?? []}
          initial={own ?? fromPhoto}
          pixelate={original.pixelate}
          disabled={blocked}
          tools={(editor, locked) => (
            <AddPhotoAreas
              onAdd={() => editor.addAreas(fromPhoto)}
              disabled={locked}
              areas={fromPhoto}
            />
          )}
        />
      </CardContent>
    </Card>
  );
}

/** Adds the photo's own areas, scaled into the crop, that aren't boxed on the original yet. */
function AddPhotoAreas({
  onAdd,
  disabled,
  areas,
}: {
  onAdd: () => void;
  disabled: boolean;
  areas: FaceBox[];
}) {
  return (
    <Button variant="outline" size="sm" disabled={disabled || areas.length === 0} onClick={onAdd}>
      <CopyPlusIcon />
      Add the photo&apos;s areas
    </Button>
  );
}

/** Why the portfolio holds the original back while its areas weren't saved against the photo's. */
function checkText(never: boolean): string {
  return never
    ? "The photo has pixelated faces, so the portfolio won't show the original until its own are saved here."
    : "The photo's pixelated areas have changed since the original's were saved, so the portfolio won't show it until they're saved again.";
}

/**
 * Whether the original's areas were saved against the photo's as they are now, and a way to keep
 * them as they are when the photo's changed but the original's still hide every face.
 */
function CheckedNote({ original, entry, saved, blocked }: OriginalPartsProps) {
  if (facesChecked(saved, entry)) return null;
  const never = entry.matchedFaces === undefined;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-500/50 p-3">
      <p className="text-sm">{checkText(never)}</p>
      {!never && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={blocked}
          onClick={() => original.pixelate.mutation.mutate(ownFaces(entry) ?? [])}
        >
          <CheckIcon />
          Keep the original&apos;s areas as they are
        </Button>
      )}
    </div>
  );
}
