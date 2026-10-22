import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { type InFlightFileRead, type UpdateResult } from "@/api/photos";
import { AllPhotosRebuild } from "@/components/all-photos-rebuild";
import { SquareThumbnailImage } from "@/components/square-thumbnail-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cropText, sameCrop } from "@/lib/crop";
import {
  type SquareUrls,
  fileName,
  isPublished,
  titleChanged,
} from "@/components/edit-in-flight/photo-json";
import { type Edit, type Save } from "@/components/edit-in-flight/use-edit";

/** The card that saves the edit, shows where it goes, and what saving did. */
export function SaveCard({ file, edit, save }: { file: InFlightFileRead; edit: Edit; save: Save }) {
  const { mutation } = save;
  const { request, baseline } = edit;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Save changes</CardTitle>
        <CardDescription>
          Remakes the Square Thumbnail and its Thumbnail Preview in R2 from the square above when it
          moved, then <SaveTarget file={file} />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {baseline && <p className="text-muted-foreground">Saved crop: {cropText(baseline)}.</p>}
        <RenameNote file={file} edit={edit} />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!request || mutation.isPending}
            onClick={() => request && mutation.mutate(request)}
          >
            {mutation.isPending && <Spinner />}
            Save changes
          </Button>
          <ResetButton edit={edit} disabled={mutation.isPending} />
        </div>
        <SaveOutcome save={save} />
      </CardContent>
    </Card>
  );
}

/** Where saving puts the photo's JSON. */
function SaveTarget({ file }: { file: InFlightFileRead }) {
  if (!isPublished(file)) {
    return (
      <>
        updates <FileLink file={file} /> in the pull request.
      </>
    );
  }
  return (
    <>
      saves <FileLink file={file} />, already in the portfolio, into the “Add photo data” pull
      request, opening one when none is open, so the change is in flight until it merges.
    </>
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

function FileLink({ file }: { file: InFlightFileRead }) {
  return (
    <a
      href={file.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="text-foreground underline underline-offset-4"
    >
      {fileName(file.path)}
    </a>
  );
}

/** Puts the square back where it was last saved, once it has moved. */
function ResetButton({ edit, disabled }: { edit: Edit; disabled: boolean }) {
  const { crop, baseline } = edit;
  if (!crop || !baseline || sameCrop(crop, baseline)) return null;
  return (
    <Button variant="outline" disabled={disabled} onClick={edit.reset}>
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
        <JsonOutcome update={update} capitalized />.
      </span>
    );
  }
  return (
    <span>
      Remade the Square Thumbnail and its Thumbnail Preview in R2 and{" "}
      <JsonOutcome update={update} />.
    </span>
  );
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
  if (!update.changed) return capitalized ? "Left its JSON as it was" : "left its JSON as it was";
  return (
    <>
      <a
        href={update.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        {capitalized ? "Updated its JSON" : "updated its JSON"}
      </a>
      <NewPullRequestNote update={update} />
    </>
  );
}

/** Where the save went, when it opened the pull request. */
function NewPullRequestNote({ update }: { update: UpdateResult }) {
  if (!update.newPullRequest) return null;
  return (
    <>
      {" "}
      in a{" "}
      <a
        href={update.pullRequestUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        new “Add photo data” pull request
      </a>
    </>
  );
}
