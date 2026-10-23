import { Link } from "@tanstack/react-router";
import { ImageUpIcon } from "lucide-react";
import type { SanitizedExif } from "@/api/exif";
import { SettingsSwitch } from "@/components/settings-switch";
import { ThumbnailCrop } from "@/components/thumbnail-crop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { type Editable, type PhotoJson } from "@/components/edit-in-flight/photo-json";
import { exifStripped, newSize, savedSize } from "@/components/edit-in-flight/replace-image";
import { type ReplaceImage, useReplaceImage } from "@/components/edit-in-flight/use-replace-image";
import { type Crop, type Size } from "@/lib/crop";
import { useReplacedImageStore } from "@/stores/replaced-image";

interface ReplaceImageCardProps {
  editable: Editable;
  /** The photo's JSON as last saved. */
  saved: PhotoJson;
  /** The square its Square Thumbnail is cut from now. */
  savedCrop: Crop | null;
  /** Other changes are waiting for Save changes, which replacing would leave out. */
  unsaved: boolean;
  /** Saving the other changes is under way. */
  disabled: boolean;
}

/**
 * Replaces a saved photo's image with a new JPEG, such as a re-edit of the same shot, keeping its
 * ID, title, places, albums, tags, spotlight and posts. A new image of another size gets its Square
 * Thumbnail picked again, in a card under this one.
 */
export function ReplaceImageCard({ editable, saved, savedCrop, ...state }: ReplaceImageCardProps) {
  const replace = useReplaceImage(editable, saved, savedCrop);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Replace image</CardTitle>
          <CardDescription>
            For a re-edit of the same shot. The new JPEG is uploaded to R2 with every size, and the
            photo keeps its ID, so links to it still work, and its title, places, albums, tags,
            spotlight and posts. Its JSON waits for Commit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ReplacedNote path={editable.file.path} />
          <ReplaceSteps replace={replace} saved={saved} {...state} />
        </CardContent>
      </Card>
      <NewImageCrop replace={replace} />
    </>
  );
}

/** Choosing the new JPEG, reading it, and what replacing it with the old one does. */
function ReplaceSteps({
  replace,
  saved,
  unsaved,
  disabled,
}: { replace: ReplaceImage; saved: PhotoJson } & Pick<
  ReplaceImageCardProps,
  "unsaved" | "disabled"
>) {
  const blocked = unsaved || disabled;
  return (
    <>
      <ImageField replace={replace} disabled={blocked} />
      <UnsavedNote unsaved={unsaved} />
      <ReadStatus replace={replace} />
      <NewImageChoices replace={replace} old={savedSize(saved)} disabled={blocked} />
    </>
  );
}

/** Why the image can't be replaced while other changes wait for Save changes. */
function UnsavedNote({ unsaved }: { unsaved: boolean }) {
  if (!unsaved) return null;
  return (
    <p className="text-muted-foreground text-sm">
      Save or undo the other changes first, since replacing the image saves the JSON.
    </p>
  );
}

/** The new image's Square Thumbnail, to pick again when it isn't the old image's size. */
function NewImageCrop({ replace }: { replace: ReplaceImage }) {
  const photo = replace.read.data && replace.read.variables;
  if (!photo || replace.keepsCrop) return null;
  return (
    <ThumbnailCrop
      title="New image's Square Thumbnail"
      photo={photo}
      crop={replace.newCrop}
      onCropChange={replace.setNewCrop}
      locked={replace.replace.isPending}
      lockedNote="Uploading with this square…"
    />
  );
}

/** Picks the new JPEG, which is read as soon as it's chosen. */
function ImageField({ replace, disabled }: { replace: ReplaceImage; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="replace-image" className="text-sm font-medium">
        New JPEG
      </label>
      <Input
        id="replace-image"
        type="file"
        accept="image/jpeg,.jpg,.jpeg"
        disabled={disabled || busy(replace)}
        onChange={(event) => {
          const photo = event.target.files?.[0];
          if (photo) replace.choose(photo);
        }}
      />
    </div>
  );
}

/** The image this photo's was last replaced with here, until the page is reloaded. */
function ReplacedNote({ path }: { path: string }) {
  const name = useReplacedImageStore((state) => state.replaced[path]);
  if (name === undefined) return null;
  return (
    <p className="text-sm">
      Replaced with <code>{name}</code>, waiting for Commit. The old image stays in R2, since the
      portfolio shows it until the pull request merges; delete it afterwards from{" "}
      <Link to="/bucket" className="underline underline-offset-4">
        Explore Bucket
      </Link>
      .
    </p>
  );
}

/** Whether the new image is being read or uploaded, so another can't be chosen yet. */
function busy(replace: ReplaceImage): boolean {
  return replace.read.isPending || replace.replace.isPending;
}

/** Reading the new image's EXIF, or why it couldn't be read. */
function ReadStatus({ replace }: { replace: ReplaceImage }) {
  const { read } = replace;
  if (read.isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner /> Reading the new image…
      </p>
    );
  }
  if (read.isError) return <p className="text-destructive text-sm">{read.error.message}</p>;
  return <NoExifNote replace={replace} />;
}

/** Why the new image can't be used when the backend read no EXIF from it. */
function NoExifNote({ replace }: { replace: ReplaceImage }) {
  if (replace.read.data?.sanitized !== null) return null;
  return (
    <p className="text-destructive text-sm">
      Couldn&apos;t read the new image&apos;s size, since exiftool isn&apos;t running on the
      backend.
    </p>
  );
}

interface NewImageChoicesProps {
  replace: ReplaceImage;
  /** The old image's size, as its JSON saves it. */
  old: Size | null;
  disabled: boolean;
}

/**
 * What happens to the Square Thumbnail and the EXIF fields, and the button that replaces the image,
 * once the new image's EXIF has been read.
 */
function NewImageChoices({ replace, old, disabled }: NewImageChoicesProps) {
  const { refreshExif, setRefreshExif } = replace;
  const sanitized = replace.read.data?.sanitized;
  if (!sanitized) return null;
  return (
    <>
      <p className="text-sm">
        <CropNote keepsCrop={replace.keepsCrop} size={newSize(sanitized)} old={old} />
      </p>
      <SettingsSwitch
        id="replace-image-exif"
        config={{
          name: "refreshExif",
          label: "Use the new image's EXIF too",
          help: <ExifHelp sanitized={sanitized} />,
        }}
        value={refreshExif}
        onChange={setRefreshExif}
      />
      <div className="flex flex-wrap items-center gap-3">
        <ReplaceButton replace={replace} disabled={disabled} />
        <ReplaceError replace={replace} />
      </div>
    </>
  );
}

/** Uploads the new image and saves the JSON, once there's a square to cut its thumbnail from. */
function ReplaceButton({ replace, disabled }: { replace: ReplaceImage; disabled: boolean }) {
  return (
    <Button
      disabled={disabled || busy(replace) || !replace.hasCrop}
      onClick={() => replace.replace.mutate()}
    >
      {replace.replace.isPending ? <Spinner /> : <ImageUpIcon />}
      Replace image
    </Button>
  );
}

/** Whether the Square Thumbnail keeps its square, or why it's picked again. */
function CropNote({
  keepsCrop,
  size,
  old,
}: {
  keepsCrop: boolean;
  size: Size | null;
  old: Size | null;
}) {
  if (keepsCrop) {
    return <>It&apos;s the same size as the old image, so the Square Thumbnail keeps its square.</>;
  }
  return (
    <>
      It&apos;s {sizeText(size)} and the old image is {sizeText(old)}, so pick its Square Thumbnail
      again below. It starts in the middle.
    </>
  );
}

function sizeText(size: Size | null): string {
  return size ? `${size.width} × ${size.height} px` : "an unknown size";
}

/** What refreshing the EXIF fields does, and a warning when the new image has none to give. */
function ExifHelp({ sanitized }: { sanitized: SanitizedExif }) {
  const fields = "camera, lens, settings, date, GPS position, country and city";
  if (exifStripped(sanitized)) {
    return (
      <>
        Off, the photo keeps its {fields}. This JPEG&apos;s EXIF has no camera or date, as edited
        exports often don&apos;t, so turning it on would clear them.
      </>
    );
  }
  return (
    <>
      Off, the photo keeps its {fields}. On, they come from the new JPEG, with the camera overrides
      and the photo&apos;s custom lens applied as for a new photo. The width and height always do.
    </>
  );
}

/** Why replacing failed, and whether the new image got as far as R2. */
function ReplaceError({ replace }: { replace: ReplaceImage }) {
  const { error } = replace.replace;
  if (!error) return null;
  const where = replace.uploadedOnly ? "The new image is in R2, but saving the JSON failed: " : "";
  return (
    <span className="text-destructive text-sm">
      {where}
      {error.message}
    </span>
  );
}
