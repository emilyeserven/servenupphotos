import { ImageUpIcon } from "lucide-react";
import type { SanitizedExif } from "@/api/exif";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { OriginalComparisonCard } from "@/components/edit-in-flight/original-comparison-card";
import { OriginalFacesCards } from "@/components/edit-in-flight/original-faces-card";
import { type Editable, type PhotoJson } from "@/components/edit-in-flight/photo-json";
import { newSize } from "@/components/edit-in-flight/replace-image";
import {
  type UneditedOriginal,
  useUneditedOriginal,
} from "@/components/edit-in-flight/use-unedited-original";

interface UneditedOriginalCardsProps {
  editable: Editable;
  /** The photo's JSON as last saved. */
  saved: PhotoJson;
  /** Other changes are waiting for Save changes, which saving the original would leave out. */
  unsaved: boolean;
  /** Saving the other changes is under way. */
  disabled: boolean;
}

/**
 * The Photo page's Original section: the photo's unedited original, straight from the camera,
 * compared with the edit, the part of it the edit was cropped to, its pixelated faces, whether the
 * portfolio's Raw vs Edited page shows it, and uploading it (or another in its place).
 */
export function UneditedOriginalCards({ editable, saved, ...state }: UneditedOriginalCardsProps) {
  const original = useUneditedOriginal(editable, saved);
  const blocked = state.unsaved || state.disabled || original.busy;
  const entry = original.original;
  const parts = { original, saved, blocked };
  return (
    <>
      {entry && (
        <>
          <OriginalComparisonCard entry={entry} {...parts} />
          <OriginalFacesCards entry={entry} {...parts} />
        </>
      )}
      <UploadCard original={original} blocked={blocked} unsaved={state.unsaved} />
    </>
  );
}

/** Uploading the original, or another in its place. */
function UploadCard({
  original,
  blocked,
  unsaved,
}: {
  original: UneditedOriginal;
  blocked: boolean;
  unsaved: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {original.original ? "Replace the unedited original" : "Unedited original"}
        </CardTitle>
        <CardDescription>
          The JPEG straight from the camera, before editing, to compare with this photo. It&apos;s
          uploaded to R2 with every size and saved in the photo&apos;s JSON, waiting for Commit. The
          portfolio only shows it once it&apos;s marked to.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {unsaved && (
          <p className="text-muted-foreground text-sm">
            Save or undo the other changes first, since this saves the JSON.
          </p>
        )}
        <UploadSteps original={original} blocked={blocked} />
      </CardContent>
    </Card>
  );
}

/** Choosing the original's JPEG, reading its size, and uploading it. */
function UploadSteps({ original, blocked }: { original: UneditedOriginal; blocked: boolean }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor="unedited-original" className="text-sm font-medium">
          Original JPEG
        </label>
        <Input
          id="unedited-original"
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          disabled={blocked}
          onChange={(event) => {
            const photo = event.target.files?.[0];
            if (photo) original.choose(photo);
          }}
        />
      </div>
      <ReadStatus original={original} />
      <UploadButton original={original} blocked={blocked} />
    </>
  );
}

/** Reading the chosen JPEG, or why it couldn't be read. */
function ReadStatus({ original: { read } }: { original: UneditedOriginal }) {
  if (read.isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner /> Reading the original…
      </p>
    );
  }
  if (read.isError) return <p className="text-destructive text-sm">{read.error.message}</p>;
  return read.isSuccess ? <NoSizeNote sanitized={read.data.sanitized} /> : null;
}

/** Why the chosen JPEG can't be uploaded when the backend read no size from it. */
function NoSizeNote({ sanitized }: { sanitized: SanitizedExif | null }) {
  if (newSize(sanitized)) return null;
  return (
    <p className="text-destructive text-sm">
      Couldn&apos;t read the original&apos;s size, since exiftool isn&apos;t running on the backend.
    </p>
  );
}

/** The button for a first original, and for another in its place, with what replacing resets. */
const UPLOAD = { button: "Upload original", note: "" };
const REPLACE = {
  button: "Replace original",
  note: " Replacing the original starts its crop and pixelation over, and takes it off the portfolio until it's shown again.",
};

/** Why something failed, when it did. */
function ErrorText({ error }: { error: Error | null }) {
  return error ? <span className="text-destructive text-sm">{error.message}</span> : null;
}

/** Uploads the chosen original, once its size is read, and says what replacing one resets. */
function UploadButton({ original, blocked }: { original: UneditedOriginal; blocked: boolean }) {
  const { read, add } = original;
  const size = newSize(read.data?.sanitized);
  if (!size) return null;
  const replacing = original.original !== null;
  const words = replacing ? REPLACE : UPLOAD;
  return (
    <>
      <p className="text-sm">
        It&apos;s {size.width} × {size.height} px.{words.note}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={blocked} onClick={() => add.mutate()}>
          <UploadIcon pending={add.isPending} />
          {words.button}
        </Button>
        <ErrorText error={add.error} />
      </div>
    </>
  );
}

function UploadIcon({ pending }: { pending: boolean }) {
  return pending ? <Spinner /> : <ImageUpIcon />;
}
