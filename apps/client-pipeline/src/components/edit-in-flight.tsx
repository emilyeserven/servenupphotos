import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { type PhotoGroups, sameGroups, savedGroups, withGroups } from "@/api/organize";
import {
  type InFlightFileRead,
  type InFlightImages,
  type InFlightRead,
  type PublishedFile,
  type PublishedResponse,
  type UpdateResult,
  photosInFlightQuery,
  publishedPhotosQuery,
  updateInFlightMutation,
} from "@/api/photos";
import {
  regenerateVersionsMutation,
  savedThumbnailCrop,
  squareThumbnailUrl,
  thumbnailCropField,
  thumbnailPreviewUrl,
  thumbnailCropQuery,
  thumbnailUrlWithCrop,
} from "@/api/versions";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { PhotoGroupsCard } from "@/components/group-picker";
import { JsonCodeBlock } from "@/components/json-code-block";
import {
  fileStem,
  type PhotoDetails,
  PhotoDetailsCard,
  DETAIL_FIELDS,
  savedDetails,
  savedExifPlace,
  withDetails,
} from "@/components/photo-details";
import { QueryResult } from "@/components/query-result";
import { SquareThumbnailImage } from "@/components/square-thumbnail-image";
import { ThumbnailCrop } from "@/components/thumbnail-crop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { type Crop, cropText, sameCrop } from "@/lib/crop";
import { jsonFileName } from "@/lib/file-name";

/**
 * A photo JSON file in the pull request, or one already in the portfolio that the pull request
 * doesn't change yet (status `published`), with the image in R2 it can be edited from.
 */
interface Editable {
  file: InFlightFileRead;
  /** The photo's JSON object as the pull request has it. */
  data: PhotoJson;
  image: { key: string; url: string };
}

type PhotoJson = Record<string, unknown> & { images?: Record<string, unknown> };

/** Whether the photo is already in the portfolio and not in the pull request yet. */
function isPublished(file: InFlightFileRead): boolean {
  return file.status === "published";
}

/** Why the file at path can't be edited, or what to edit it from. */
function findEditable(data: InFlightRead, path: string): Editable | string {
  const file = data.files.find((f) => f.path === path);
  const problem = editProblem(data, file, path);
  if (problem !== undefined || !file) return problem ?? "";
  return { file, data: file.data as PhotoJson, image: data.images.byPath[path]! };
}

/** Why the file at path can't be edited, or undefined when it can. */
function editProblem(
  data: InFlightRead,
  file: InFlightFileRead | undefined,
  path: string,
): string | undefined {
  if (!data.pullRequest) return "No photo data pull request is open.";
  if (!file) return `${path} isn't in the photo data pull request anymore.`;
  return fileProblem(file) ?? imageProblem(data.images, path);
}

/** Why the file's JSON can't be edited, or undefined when it can. */
function fileProblem(file: InFlightFileRead): string | undefined {
  if (file.error) return file.error;
  return isObject(file.data) ? undefined : `${file.path} isn't a JSON object.`;
}

/** Why the file at path has no image in R2 to edit, or undefined when it has one. */
function imageProblem(images: InFlightImages, path: string): string | undefined {
  if (images.byPath[path]) return undefined;
  if (!images.checked) return images.message ?? "Couldn't check R2 for its photo.";
  return "Its photo isn't in R2, so there's nothing to cut a Square Thumbnail from.";
}

/** Why the file at path, already in the portfolio, can't be edited, or what to edit it from. */
function findPublished(data: PublishedResponse, path: string): Editable | string {
  const file = data.files.find((f) => f.path === path);
  if (!file) return `${path} isn't in the photo data pull request or on ${data.branch}.`;
  const problem = publishedProblem(file) ?? imageProblem(data.images, path);
  if (problem !== undefined) return problem;
  return { file, data: file.data as PhotoJson, image: data.images.byPath[path]! };
}

/** Why a file already in the portfolio can't be edited, or undefined when it can. */
function publishedProblem(file: PublishedFile): string | undefined {
  if (file.inFlight === "removed") {
    return `${file.path} is removed in the photo data pull request, so it can't be edited.`;
  }
  return fileProblem(file);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The Photo page for a photo in the photo data pull request, or already in the portfolio: its
 * Square Thumbnail crop, title, place name and comment can be changed, then saved by remaking the thumbnail in R2
 * when the crop moved and updating its JSON in the pull request. A photo already in the portfolio is
 * read from the base branch until its first save puts it in the pull request.
 */
export function EditInFlightPhoto({ path, from }: { path: string; from?: "gallery" }) {
  const inFlight = useQuery(photosInFlightQuery);
  return (
    <>
      <BackLink from={from} />
      <QueryResult query={inFlight} pendingLabel="Reading the pull request from GitHub…">
        {(data) => <EditFound inFlight={data} path={path} />}
      </QueryResult>
    </>
  );
}

/**
 * The editor for the file at path, from the pull request when it's there, or else from the base
 * branch. Both render the editor in the same place with the same key, so it keeps what it showed
 * when a first save moves the photo into the pull request.
 */
function EditFound({ inFlight, path }: { inFlight: InFlightRead; path: string }) {
  const editable = useEditable(inFlight, path);
  if (editable === null) return <p>Reading the photo from GitHub…</p>;
  if (typeof editable === "string") return <Problem>{editable}</Problem>;
  // Keyed by the photo's image rather than its file, which a new title can rename.
  return <EditWithSavedCrop key={editable.image.key} editable={editable} />;
}

/**
 * What to edit the file at path from, or why it can't be edited: the pull request's copy when the
 * pull request has it, or else the base branch's, which is null while it's being read.
 */
function useEditable(inFlight: InFlightRead, path: string): Editable | string | null {
  const fromPullRequest = findEditable(inFlight, path);
  const onBase = typeof fromPullRequest === "string" && !inPullRequest(inFlight, path);
  const published = useQuery({ ...publishedPhotosQuery, enabled: onBase });
  return onBase ? fromBase(published, path) : fromPullRequest;
}

/** Whether the pull request has the file at path, so it's edited from there. */
function inPullRequest(inFlight: InFlightRead, path: string): boolean {
  return inFlight.files.some((f) => f.path === path);
}

/** The file at path on the base branch to edit, why it can't be, or null while it's read. */
function fromBase(
  published: UseQueryResult<PublishedResponse>,
  path: string,
): Editable | string | null {
  if (published.isError) return published.error.message;
  return published.data ? findPublished(published.data, path) : null;
}

function BackLink({ from }: { from?: "gallery" }) {
  return (
    <Button variant="outline" size="sm" className="self-start" asChild>
      <Link to={from === "gallery" ? "/gallery" : "/in-flight"}>
        <ArrowLeftIcon />
        {from === "gallery" ? "Gallery" : "Photos in Flight"}
      </Link>
    </Button>
  );
}

function Problem({ children }: { children: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Waits for the crop saved with the Square Thumbnail, which the editor starts from, or else the one
 * saved in the photo's JSON.
 */
function EditWithSavedCrop({ editable }: { editable: Editable }) {
  const saved = useQuery(thumbnailCropQuery(editable.image.key));
  return (
    <QueryResult query={saved} pendingLabel="Reading the Square Thumbnail's crop from R2…">
      {(crop) => (
        <EditSteps
          editable={editable}
          savedCrop={crop ?? savedThumbnailCrop(editable.data.images)}
        />
      )}
    </QueryResult>
  );
}

/** The versions cut from the Square Thumbnail's crop, by their key in `images`, with where R2 has each. */
const SQUARE_URLS = { thumbnail: squareThumbnailUrl, thumbnailpreview: thumbnailPreviewUrl };

type SquareName = keyof typeof SQUARE_URLS;

const SQUARE_NAMES = Object.keys(SQUARE_URLS) as SquareName[];

type SquareUrls = Record<SquareName, string>;

/** data with its square versions' URLs marked with crop, and crop saved as their `thumbnailcrop`. */
function withSquares(data: PhotoJson, urls: SquareUrls, crop: Crop): PhotoJson {
  return {
    ...data,
    images: { ...data.images, ...markedUrls(urls, crop), thumbnailcrop: thumbnailCropField(crop) },
  };
}

/** data with crop, the square its square versions were cut from, saved as their `thumbnailcrop` when it isn't yet. */
function withCropField(data: PhotoJson, crop: Crop | null): PhotoJson {
  if (!crop || !hasThumbnail(data) || savedThumbnailCrop(data.images)) return data;
  return { ...data, images: { ...data.images, thumbnailcrop: thumbnailCropField(crop) } };
}

/** urls, each marked with crop. */
function markedUrls(urls: SquareUrls, crop: Crop): SquareUrls {
  const marked = SQUARE_NAMES.map((name) => [name, thumbnailUrlWithCrop(urls[name], crop)]);
  return Object.fromEntries(marked) as SquareUrls;
}

/** The square versions' URLs saved in data, or else the ones next to the photo's image in R2. */
function squareUrls(data: PhotoJson, imageUrl: string): SquareUrls {
  const urls = SQUARE_NAMES.map((name) => [
    name,
    savedUrl(data.images?.[name]) ?? SQUARE_URLS[name](imageUrl),
  ]);
  return Object.fromEntries(urls) as SquareUrls;
}

function savedUrl(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/** Whether saving would remake the square versions; a photo saved before Square Thumbnails or Thumbnail Previews gets them even without a new crop. */
function cropChanged(crop: Crop | null, baseline: Crop | null, saved: PhotoJson): boolean {
  if (!crop || !baseline) return false;
  return !sameCrop(crop, baseline) || !hasThumbnail(saved);
}

function hasThumbnail(saved: PhotoJson): boolean {
  return SQUARE_NAMES.every((name) => savedUrl(saved.images?.[name]));
}

/** Whether the title, place name, custom city or country, or comment differs from the ones saved in data. */
function detailsChanged(data: PhotoJson, details: PhotoDetails): boolean {
  const next = withDetails({}, details);
  return DETAIL_FIELDS.some((key) => next[key] !== (data[key] ?? null));
}

/** Whether the details, albums or tags differ from the ones saved in data. */
function fieldsChanged(data: PhotoJson, details: PhotoDetails, groups: PhotoGroups): boolean {
  return detailsChanged(data, details) || !sameGroups(savedGroups(data), groups);
}

/**
 * The file name, without .json, that a new title moves the file to, or undefined when it keeps its
 * name: the title is unchanged, the new name is the same, or the file is already in the portfolio.
 */
function newFileName(file: InFlightFileRead, saved: PhotoJson, title: string): string | undefined {
  if (file.status !== "added" || !titleChanged(saved, title)) return undefined;
  const name = jsonFileName(title, photoFile(saved));
  return `${name}.json` === fileName(file.path) ? undefined : name;
}

function titleChanged(saved: PhotoJson, title: string): boolean {
  return title.trim() !== savedDetails(saved).title.trim();
}

/** The photo's original file name, as saved in its JSON. */
function photoFile(saved: PhotoJson): string {
  return typeof saved.file === "string" ? saved.file : "";
}

/**
 * What saving would do: the crop to remake the square versions from, if they need it, and the JSON to
 * write, which saves baseline as the square versions' crop when they're kept and it isn't saved yet.
 */
function saveRequest(
  saved: PhotoJson,
  details: PhotoDetails,
  groups: PhotoGroups,
  crop: Crop | null,
  baseline: Crop | null,
  remakeSquares: boolean,
): SaveRequest {
  const data = withGroups(withDetails(saved, details), groups);
  return remakeSquares ? { crop, data } : { crop: null, data: withCropField(data, baseline) };
}

/** The JSON a save request would write, with its square versions marked with the new crop. */
function nextJson({ crop, data }: SaveRequest, imageUrl: string): PhotoJson {
  return crop ? withSquares(data, squareUrls(data, imageUrl), crop) : data;
}

/** The crop, title, place name, comment, albums and tags being edited, against the last ones saved, and the JSON saving them would write. */
function useEdit({ file, data, image }: Editable, savedCrop: Crop | null) {
  const [crop, setCrop] = useState<Crop | null>(savedCrop);
  // The editor reports the middle first when no crop was saved, which then counts as saved.
  const [baseline, setBaseline] = useState<Crop | null>(savedCrop);
  const [savedData, setSavedData] = useState(data);
  const [details, setDetails] = useState(() => savedDetails(data));
  const [groups, setGroups] = useState(() => savedGroups(data));
  const remakeSquares = cropChanged(crop, baseline, savedData);
  const changed = remakeSquares || fieldsChanged(savedData, details, groups);
  const request = {
    ...saveRequest(savedData, details, groups, crop, baseline, remakeSquares),
    name: newFileName(file, savedData, details.title),
  };
  return {
    crop,
    baseline,
    savedData,
    details,
    setDetails,
    groups,
    setGroups,
    /** What saving would do, when there's anything to save. */
    request: changed ? request : null,
    /** The JSON saving would write, when there's anything to save. */
    next: changed ? nextJson(request, image.url) : null,
    onCropChange: (next: Crop) => {
      setCrop(next);
      setBaseline((current) => current ?? next);
    },
    reset: () => setCrop(baseline),
    onSaved: (saved: Crop | null, json: PhotoJson) => {
      if (saved) setBaseline(saved);
      setSavedData(json);
    },
  };
}

type Edit = ReturnType<typeof useEdit>;

interface EditStepsProps {
  editable: Editable;
  /** The crop saved with the Square Thumbnail in R2; null when it was cut from the middle. */
  savedCrop: Crop | null;
}

function EditSteps({ editable, savedCrop }: EditStepsProps) {
  const edit = useEdit(editable, savedCrop);
  const save = useSave(editable, edit.onSaved);
  const pending = save.mutation.isPending;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        <ThumbnailCrop
          photo={editable.image.url}
          crop={edit.crop}
          onCropChange={edit.onCropChange}
          locked={pending}
          lockedNote="Saving the Square Thumbnail with this square…"
        />
        <SaveCard file={editable.file} edit={edit} save={save} />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <PhotoDetailsCard
          value={edit.details}
          onChange={edit.setDetails}
          fallbackTitle={fileStem(photoFile(editable.data) || fileName(editable.file.path))}
          exifPlace={savedExifPlace(edit.savedData)}
          description="All optional. Saving changes writes them over the ones in the JSON, and a new title renames a file that's new in the pull request."
          disabled={pending}
        />
        <PhotoGroupsCard
          value={edit.groups}
          onChange={edit.setGroups}
          description="Saving changes writes them over the ones in the JSON."
          disabled={pending}
        />
        <JsonPreview file={editable.file} edit={edit} />
      </div>
    </div>
  );
}

/** The file's JSON, as saving would write it when there's something to save. */
function JsonPreview({ file, edit }: { file: InFlightFileRead; edit: Edit }) {
  const where = isPublished(file) ? "the portfolio" : "the pull request";
  return (
    <Card>
      <CardHeader>
        <CardTitle>JSON to Upload</CardTitle>
        <CardDescription>
          {edit.next
            ? "What saving writes over the file in the pull request."
            : `The file as ${where} has it.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <JsonCodeBlock value={edit.next ?? edit.savedData} title={file.path} />
      </CardContent>
    </Card>
  );
}

interface SaveRequest {
  /** The crop to remake the square versions from, or null to leave them as they are. */
  crop: Crop | null;
  /** The JSON to save, with the new Square Thumbnail marked in it when there's a crop. */
  data: PhotoJson;
  /** A new file name, without .json, to move the file to. */
  name?: string;
}

interface SaveResult {
  crop: Crop | null;
  data: PhotoJson;
  /** The square versions' new URLs, marked with the crop, when they were remade. */
  squares: SquareUrls | null;
  update: UpdateResult;
}

/**
 * Remakes the Square Thumbnail and its Thumbnail Preview in R2 from a crop, when there is one, then
 * saves the photo's JSON, with their URLs marked with that crop, over the file in the pull request.
 */
function useSave({ file, image }: Editable, onSaved: (crop: Crop | null, data: PhotoJson) => void) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rebuild = useAllPhotosRebuild(true, () => {
    void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
  });
  const regenerate = useMutation(regenerateVersionsMutation);
  const update = useMutation(updateInFlightMutation);
  const mutation = useMutation({
    mutationFn: async ({ crop, data, name }: SaveRequest): Promise<SaveResult> => {
      if (!crop) {
        const updated = await update.mutateAsync({ path: file.path, data, name });
        return { crop, data, squares: null, update: updated };
      }
      const made = await regenerate.mutateAsync({ key: image.key, versions: SQUARE_NAMES, crop });
      const urls = { ...squareUrls(data, image.url), ...madeUrls(made.versions) };
      const next = withSquares(data, urls, crop);
      const updated = await update.mutateAsync({ path: file.path, data: next, name });
      return { crop, data: next, squares: markedUrls(urls, crop), update: updated };
    },
    onSuccess: (result) => {
      onSaved(result.crop, result.data);
      if (result.update.path !== file.path) {
        // Follow the file to its new name, in the cache until the pull request is read again.
        queryClient.setQueryData(
          photosInFlightQuery.queryKey,
          (data) => data && renamedInFlight(data, file.path, result.update),
        );
        void navigate({ to: "/exif", search: { edit: result.update.path }, replace: true });
      }
      void queryClient.invalidateQueries({ queryKey: thumbnailCropQuery(image.key).queryKey });
      void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
      if (!result.update.changed) return;
      // A photo already in the portfolio is in the pull request after its first save.
      void queryClient.invalidateQueries({ queryKey: publishedPhotosQuery.queryKey });
      rebuild.afterPush();
    },
  });
  // The thumbnail was remade when only saving the JSON failed.
  const remadeOnly = mutation.isError && update.isError;
  return { mutation, rebuild, remadeOnly };
}

type Save = ReturnType<typeof useSave>;

/** data with the file at `from` moved to the updated file's path. */
function renamedInFlight(data: InFlightRead, from: string, updated: UpdateResult): InFlightRead {
  const { [from]: image, ...byPath } = data.images.byPath;
  return {
    ...data,
    files: data.files.map((f) =>
      f.path === from ? { ...f, path: updated.path, fileUrl: updated.fileUrl } : f,
    ),
    images: { ...data.images, byPath: image ? { ...byPath, [updated.path]: image } : byPath },
  };
}

/** The URLs of the square versions R2 answered with. */
function madeUrls(made: Partial<Record<string, { url: string }>>): Partial<SquareUrls> {
  const urls = SQUARE_NAMES.flatMap((name) => (made[name] ? [[name, made[name].url]] : []));
  return Object.fromEntries(urls) as Partial<SquareUrls>;
}

function SaveCard({ file, edit, save }: { file: InFlightFileRead; edit: Edit; save: Save }) {
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

/** The last part of a repository path. */
function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
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
