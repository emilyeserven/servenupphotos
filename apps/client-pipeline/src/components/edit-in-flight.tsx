import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import {
  type InFlightFile,
  type InFlightImages,
  type InFlightResponse,
  type UpdateResult,
  photosInFlightQuery,
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
import { JsonCodeBlock } from "@/components/json-code-block";
import {
  fileStem,
  type PhotoDetails,
  PhotoDetailsCard,
  savedDetails,
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

/** A photo JSON file in the pull request, with the image in R2 it can be edited from. */
interface Editable {
  file: InFlightFile;
  /** The photo's JSON object as the pull request has it. */
  data: PhotoJson;
  image: { key: string; url: string };
}

type PhotoJson = Record<string, unknown> & { images?: Record<string, unknown> };

/** Why the file at path can't be edited, or what to edit it from. */
function findEditable(data: InFlightResponse, path: string): Editable | string {
  const file = data.files.find((f) => f.path === path);
  const problem = editProblem(data, file, path);
  if (problem !== undefined || !file) return problem ?? "";
  return { file, data: file.data as PhotoJson, image: data.images.byPath[path]! };
}

/** Why the file at path can't be edited, or undefined when it can. */
function editProblem(
  data: InFlightResponse,
  file: InFlightFile | undefined,
  path: string,
): string | undefined {
  if (!data.pullRequest) return "No photo data pull request is open.";
  if (!file) return `${path} isn't in the photo data pull request anymore.`;
  return fileProblem(file) ?? imageProblem(data.images, path);
}

/** Why the file's JSON can't be edited, or undefined when it can. */
function fileProblem(file: InFlightFile): string | undefined {
  if (file.error) return file.error;
  return isObject(file.data) ? undefined : `${file.path} isn't a JSON object.`;
}

/** Why the file at path has no image in R2 to edit, or undefined when it has one. */
function imageProblem(images: InFlightImages, path: string): string | undefined {
  if (images.byPath[path]) return undefined;
  if (!images.checked) return images.message ?? "Couldn't check R2 for its photo.";
  return "Its photo isn't in R2, so there's nothing to cut a Square Thumbnail from.";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The Photo page for a photo already in the photo data pull request: its Square Thumbnail crop, title
 * and comment can be changed, then saved by remaking the thumbnail in R2 when the crop moved and
 * updating its JSON in the pull request.
 */
export function EditInFlightPhoto({ path }: { path: string }) {
  const inFlight = useQuery(photosInFlightQuery);
  return (
    <>
      <BackLink />
      <QueryResult query={inFlight} pendingLabel="Reading the pull request from GitHub…">
        {(data) => {
          const editable = findEditable(data, path);
          if (typeof editable === "string") return <Problem>{editable}</Problem>;
          // Keyed by the photo's image rather than its file, which a new title can rename.
          return <EditWithSavedCrop key={editable.image.key} editable={editable} />;
        }}
      </QueryResult>
    </>
  );
}

function BackLink() {
  return (
    <Button variant="outline" size="sm" className="self-start" asChild>
      <Link to="/in-flight">
        <ArrowLeftIcon />
        Photos in Flight
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

/** Whether the title or comment differs from the ones saved in data. */
function detailsChanged(data: PhotoJson, details: PhotoDetails): boolean {
  const next = withDetails({}, details);
  return next.title !== (data.title ?? null) || next.comment !== (data.comment ?? null);
}

/**
 * The file name, without .json, that a new title moves the file to, or undefined when it keeps its
 * name: the title is unchanged, the new name is the same, or the file is already in the portfolio.
 */
function newFileName(file: InFlightFile, saved: PhotoJson, title: string): string | undefined {
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
  crop: Crop | null,
  baseline: Crop | null,
  remakeSquares: boolean,
): SaveRequest {
  const data = withDetails(saved, details);
  return remakeSquares ? { crop, data } : { crop: null, data: withCropField(data, baseline) };
}

/** The JSON a save request would write, with its square versions marked with the new crop. */
function nextJson({ crop, data }: SaveRequest, imageUrl: string): PhotoJson {
  return crop ? withSquares(data, squareUrls(data, imageUrl), crop) : data;
}

/** The crop, title and comment being edited, against the last ones saved, and the JSON saving them would write. */
function useEdit({ file, data, image }: Editable, savedCrop: Crop | null) {
  const [crop, setCrop] = useState<Crop | null>(savedCrop);
  // The editor reports the middle first when no crop was saved, which then counts as saved.
  const [baseline, setBaseline] = useState<Crop | null>(savedCrop);
  const [savedData, setSavedData] = useState(data);
  const [details, setDetails] = useState(() => savedDetails(data));
  const remakeSquares = cropChanged(crop, baseline, savedData);
  const changed = remakeSquares || detailsChanged(savedData, details);
  const request = {
    ...saveRequest(savedData, details, crop, baseline, remakeSquares),
    name: newFileName(file, savedData, details.title),
  };
  return {
    crop,
    baseline,
    savedData,
    details,
    setDetails,
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
          description="Both optional. Saving changes writes them over the ones in the JSON, and a new title renames a file that's new in the pull request."
          disabled={pending}
        />
        <JsonPreview path={editable.file.path} edit={edit} />
      </div>
    </div>
  );
}

/** The file's JSON, as saving would write it when there's something to save. */
function JsonPreview({ path, edit }: { path: string; edit: Edit }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>JSON to Upload</CardTitle>
        <CardDescription>
          {edit.next
            ? "What saving writes over the file in the pull request."
            : "The file as the pull request has it."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <JsonCodeBlock value={edit.next ?? edit.savedData} title={path} />
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
      if (result.update.changed) rebuild.afterPush();
    },
  });
  // The thumbnail was remade when only saving the JSON failed.
  const remadeOnly = mutation.isError && update.isError;
  return { mutation, rebuild, remadeOnly };
}

type Save = ReturnType<typeof useSave>;

/** data with the file at `from` moved to the updated file's path. */
function renamedInFlight(
  data: InFlightResponse,
  from: string,
  updated: UpdateResult,
): InFlightResponse {
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

function SaveCard({ file, edit, save }: { file: InFlightFile; edit: Edit; save: Save }) {
  const { mutation } = save;
  const { request, baseline } = edit;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Save changes</CardTitle>
        <CardDescription>
          Remakes the Square Thumbnail and its Thumbnail Preview in R2 from the square above when it
          moved, then updates <FileLink file={file} /> in the pull request.
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

/** What a new title does to the file's name when it's saved. */
function RenameNote({ file, edit }: { file: InFlightFile; edit: Edit }) {
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
function KeepsNameNote({ file, edit }: { file: InFlightFile; edit: Edit }) {
  if (file.status === "added" || !titleChanged(edit.savedData, edit.details.title)) return null;
  return (
    <p className="text-muted-foreground">
      It keeps its file name, since it's {file.status} in the pull request and so already in the
      portfolio.
    </p>
  );
}

/** The last part of a repository path. */
function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function FileLink({ file }: { file: InFlightFile }) {
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
    <a
      href={update.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-4"
    >
      {capitalized ? "Updated its JSON" : "updated its JSON"}
    </a>
  );
}
