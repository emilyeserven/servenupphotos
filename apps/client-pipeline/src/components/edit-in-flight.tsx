import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
  squareThumbnailUrl,
  thumbnailPreviewUrl,
  thumbnailCropQuery,
  thumbnailUrlWithCrop,
} from "@/api/versions";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { JsonCodeBlock } from "@/components/json-code-block";
import { QueryResult } from "@/components/query-result";
import { SquareThumbnailImage } from "@/components/square-thumbnail-image";
import { ThumbnailCrop } from "@/components/thumbnail-crop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { type Crop, cropText, sameCrop } from "@/lib/crop";

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
 * The Photo page for a photo already in the photo data pull request: its Square Thumbnail crop can
 * be changed, then saved by remaking the thumbnail in R2 and updating its JSON in the pull request.
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
          // Keyed by file, so another photo starts over.
          return <EditWithSavedCrop key={editable.file.path} editable={editable} />;
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

/** Waits for the crop saved with the Square Thumbnail, which the editor starts from. */
function EditWithSavedCrop({ editable }: { editable: Editable }) {
  const saved = useQuery(thumbnailCropQuery(editable.image.key));
  return (
    <QueryResult query={saved} pendingLabel="Reading the Square Thumbnail's crop from R2…">
      {(crop) => <EditSteps editable={editable} savedCrop={crop} />}
    </QueryResult>
  );
}

/** The versions cut from the Square Thumbnail's crop, by their key in `images`, with where R2 has each. */
const SQUARE_URLS = { thumbnail: squareThumbnailUrl, thumbnailpreview: thumbnailPreviewUrl };

type SquareName = keyof typeof SQUARE_URLS;

const SQUARE_NAMES = Object.keys(SQUARE_URLS) as SquareName[];

type SquareUrls = Record<SquareName, string>;

/** data with its square versions' URLs, marked with crop. */
function withSquares(data: PhotoJson, urls: SquareUrls, crop: Crop): PhotoJson {
  return { ...data, images: { ...data.images, ...markedUrls(urls, crop) } };
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

/** Whether saving would change anything; a photo saved before Square Thumbnails or Thumbnail Previews gets them even without a new crop. */
function hasChanges(crop: Crop | null, baseline: Crop | null, saved: PhotoJson): boolean {
  if (!crop || !baseline) return false;
  return !sameCrop(crop, baseline) || !hasThumbnail(saved);
}

function hasThumbnail(saved: PhotoJson): boolean {
  return SQUARE_NAMES.every((name) => savedUrl(saved.images?.[name]));
}

/** saved with its Square Thumbnail marked with crop. */
function nextJson(saved: PhotoJson, imageUrl: string, crop: Crop | null): PhotoJson | null {
  return crop && withSquares(saved, squareUrls(saved, imageUrl), crop);
}

/** The crop being picked, against the last one saved, and the JSON saving it would write. */
function useCropEdit({ data, image }: Editable, savedCrop: Crop | null) {
  const [crop, setCrop] = useState<Crop | null>(savedCrop);
  // The editor reports the middle first when no crop was saved, which then counts as saved.
  const [baseline, setBaseline] = useState<Crop | null>(savedCrop);
  const [savedData, setSavedData] = useState(data);
  const changed = hasChanges(crop, baseline, savedData);
  return {
    crop,
    baseline,
    savedData,
    changed,
    /** The JSON saving would write, when there's anything to save. */
    next: changed ? nextJson(savedData, image.url, crop) : null,
    onCropChange: (next: Crop) => {
      setCrop(next);
      setBaseline((current) => current ?? next);
    },
    reset: () => setCrop(baseline),
    onSaved: (saved: Crop, json: PhotoJson) => {
      setBaseline(saved);
      setSavedData(json);
    },
  };
}

type CropEdit = ReturnType<typeof useCropEdit>;

interface EditStepsProps {
  editable: Editable;
  /** The crop saved with the Square Thumbnail in R2; null when it was cut from the middle. */
  savedCrop: Crop | null;
}

function EditSteps({ editable, savedCrop }: EditStepsProps) {
  const edit = useCropEdit(editable, savedCrop);
  const save = useSave(editable, edit.onSaved);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        <ThumbnailCrop
          photo={editable.image.url}
          crop={edit.crop}
          onCropChange={edit.onCropChange}
          locked={save.mutation.isPending}
          lockedNote="Saving the Square Thumbnail with this square…"
        />
        <SaveCard file={editable.file} edit={edit} save={save} />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <JsonPreview path={editable.file.path} edit={edit} />
      </div>
    </div>
  );
}

/** The file's JSON, as saving would write it when there's something to save. */
function JsonPreview({ path, edit }: { path: string; edit: CropEdit }) {
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
  crop: Crop;
  /** The JSON to mark the new Square Thumbnail in. */
  data: PhotoJson;
}

interface SaveResult {
  crop: Crop;
  data: PhotoJson;
  /** The square versions' new URLs, marked with the crop. */
  squares: SquareUrls;
  update: UpdateResult;
}

/**
 * Remakes the Square Thumbnail and its Thumbnail Preview in R2 from a crop, then saves the photo's
 * JSON, with their URLs marked with that crop, over the file in the pull request.
 */
function useSave({ file, image }: Editable, onSaved: (crop: Crop, data: PhotoJson) => void) {
  const queryClient = useQueryClient();
  const rebuild = useAllPhotosRebuild(true, () => {
    void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
  });
  const regenerate = useMutation(regenerateVersionsMutation);
  const update = useMutation(updateInFlightMutation);
  const mutation = useMutation({
    mutationFn: async ({ crop, data }: SaveRequest): Promise<SaveResult> => {
      const made = await regenerate.mutateAsync({ key: image.key, versions: SQUARE_NAMES, crop });
      const urls = { ...squareUrls(data, image.url), ...madeUrls(made.versions) };
      const next = withSquares(data, urls, crop);
      const updated = await update.mutateAsync({ path: file.path, data: next });
      return { crop, data: next, squares: markedUrls(urls, crop), update: updated };
    },
    onSuccess: (result) => {
      onSaved(result.crop, result.data);
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

/** The URLs of the square versions R2 answered with. */
function madeUrls(made: Partial<Record<string, { url: string }>>): Partial<SquareUrls> {
  const urls = SQUARE_NAMES.flatMap((name) => (made[name] ? [[name, made[name].url]] : []));
  return Object.fromEntries(urls) as Partial<SquareUrls>;
}

function SaveCard({ file, edit, save }: { file: InFlightFile; edit: CropEdit; save: Save }) {
  const { mutation } = save;
  const { crop, baseline } = edit;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Save changes</CardTitle>
        <CardDescription>
          Remakes the Square Thumbnail and its Thumbnail Preview in R2 from the square above, then
          updates <FileLink file={file} /> in the pull request.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {baseline && <p className="text-muted-foreground">Saved crop: {cropText(baseline)}.</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!edit.changed || mutation.isPending}
            onClick={() => crop && mutation.mutate({ crop, data: edit.savedData })}
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
function ResetButton({ edit, disabled }: { edit: CropEdit; disabled: boolean }) {
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
        <span>
          Remade the Square Thumbnail and its Thumbnail Preview in R2 and{" "}
          <JsonOutcome update={update} />.
        </span>
      </p>
      {update.changed && <AllPhotosRebuild status={rebuild.status} />}
      <SquareThumbnailImage
        key={squares.thumbnail}
        name={fileName(update.path)}
        url={squares.thumbnail}
        previewUrl={squares.thumbnailpreview}
      />
    </div>
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

function JsonOutcome({ update }: { update: UpdateResult }) {
  if (!update.changed) return "left its JSON as it was";
  return (
    <a
      href={update.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-4"
    >
      updated its JSON
    </a>
  );
}
