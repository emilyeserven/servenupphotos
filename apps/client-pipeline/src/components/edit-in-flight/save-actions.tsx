import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { type InFlightFileRead, type UpdateResult } from "@/api/photos";
import { AllPhotosRebuild } from "@/components/all-photos-rebuild";
import { FloatingAction } from "@/components/floating-actions";
import { SquareThumbnailImage } from "@/components/square-thumbnail-image";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { sameCrop } from "@/lib/crop";
import {
  type SquareUrls,
  fileName,
  isPublished,
  titleChanged,
} from "@/components/edit-in-flight/photo-json";
import { type Edit, type Save } from "@/components/edit-in-flight/use-edit";

/**
 * Save changes and, once the square has moved, a way back to the saved crop, floated next to the
 * sync button at the top right.
 */
export function SaveActions({ edit, save }: { edit: Edit; save: Save }) {
  const { mutation } = save;
  const { request } = edit;
  return (
    <FloatingAction>
      <ResetButton edit={edit} disabled={mutation.isPending} />
      <Button
        className="h-9 rounded-full shadow-md"
        disabled={!request || mutation.isPending}
        onClick={() => request && mutation.mutate(request)}
      >
        {mutation.isPending && <Spinner />}
        Save changes
      </Button>
    </FloatingAction>
  );
}

/** What saving will rename the file to, then what the last save did; nothing when there's neither. */
export function SaveStatus({
  file,
  edit,
  save,
}: {
  file: InFlightFileRead;
  edit: Edit;
  save: Save;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm empty:hidden lg:col-span-2">
      <RenameNote file={file} edit={edit} />
      <SaveOutcome save={save} />
    </div>
  );
}

/** What a new title does to the file's name when it's saved. */
function RenameNote({ file, edit }: { file: InFlightFileRead; edit: Edit }) {
  const name = edit.request?.name;
  if (name) {
    return (
      <p>
        Saving renames it to <code>{name}.json</code>, after the new title.
      </p>
    );
  }
  return <KeepsNameNote file={file} edit={edit} />;
}

/** Why a new title doesn't rename a file that's already in the portfolio. */
function KeepsNameNote({ file, edit }: { file: InFlightFileRead; edit: Edit }) {
  if (file.status === "added" || !titleChanged(edit.savedData, edit.details.title)) return null;
  return (
    <p className="text-muted-foreground">
      It keeps its file name,{" "}
      {isPublished(file)
        ? "since it's already in the portfolio and renaming it would remove the old file when the pull request merges."
        : `since it's ${file.status} in the pull request and so already in the portfolio.`}
    </p>
  );
}

/** Puts the square back where it was last saved, once it has moved. */
function ResetButton({ edit, disabled }: { edit: Edit; disabled: boolean }) {
  const { crop, baseline } = edit;
  if (!crop || !baseline || sameCrop(crop, baseline)) return null;
  return (
    <Button
      variant="outline"
      className="bg-background h-9 rounded-full shadow-md"
      disabled={disabled}
      onClick={edit.reset}
    >
      <RotateCcwIcon />
      Back to the saved crop
    </Button>
  );
}

/** What the last save did, or which step of it failed. */
function SaveOutcome({ save }: { save: Save }) {
  const { mutation, rebuild } = save;
  if (mutation.isError) return <SaveError save={save} />;
  if (!mutation.isSuccess) return null;
  const { squares, update } = mutation.data;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <SaveOutcomeText remade={squares !== null} update={update} />
      </p>
      {update.changed && <AllPhotosRebuild status={rebuild.status} />}
      <RemadeThumbnail squares={squares} path={update.path} />
    </div>
  );
}

/** The Square Thumbnail a save remade, when it remade one. */
function RemadeThumbnail({ squares, path }: { squares: SquareUrls | null; path: string }) {
  if (!squares) return null;
  return (
    <SquareThumbnailImage
      key={squares.thumbnail}
      name={fileName(path)}
      url={squares.thumbnail}
      previewUrl={squares.thumbnailpreview}
    />
  );
}

function SaveOutcomeText({ remade, update }: { remade: boolean; update: UpdateResult }) {
  if (!remade) {
    return (
      <span>
        <JsonOutcome update={update} capitalized />. <Waiting update={update} />
      </span>
    );
  }
  return (
    <span>
      Remade the Square Thumbnail and its Thumbnail Preview in R2 and{" "}
      <JsonOutcome update={update} />. <Waiting update={update} />
    </span>
  );
}

/** Where a changed JSON goes next: Commit sends it to GitHub. */
function Waiting({ update }: { update: UpdateResult }) {
  if (!update.changed) return null;
  return <WaitingForCommit pullRequestUrl={update.pullRequestUrl} what="The JSON" />;
}

function SaveError({ save: { mutation, remadeOnly } }: { save: Save }) {
  const message = mutation.error?.message;
  return (
    <p className="text-destructive">
      {remadeOnly
        ? `The Square Thumbnail was remade in R2, but the JSON couldn't be saved: ${message}`
        : message}
    </p>
  );
}

function JsonOutcome({ update, capitalized }: { update: UpdateResult; capitalized?: boolean }) {
  const text = update.changed ? "aved its JSON in the app" : "eft its JSON as it was";
  const first = update.changed ? "s" : "l";
  return (capitalized ? first.toUpperCase() : first) + text;
}
