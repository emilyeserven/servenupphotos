import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CheckIcon,
  GitPullRequestArrowIcon,
  ImageOffIcon,
  ListChecksIcon,
  PencilIcon,
  SearchIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  type InFlightImages,
  type PublishedFile,
  type PublishedResponse,
  publishedPhotosQuery,
} from "@/api/photos";
import {
  type GroupKind,
  NO_GROUPS,
  type OrganizeResponse,
  type PhotoGroups,
  addPhotoGroupsMutation,
  groupLabel,
  organizeQuery,
  savedGroups,
} from "@/api/organize";
import { settingsQuery } from "@/api/settings";
import { squareThumbnailUrl, thumbnailPreviewUrl } from "@/api/versions";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { PhotoGroupFields, Warning } from "@/components/group-picker";
import { ImageLightbox } from "@/components/image-lightbox";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  staticData: { wide: true },
});

function GalleryPage() {
  const settings = useQuery(settingsQuery);
  return (
    <Page
      wide
      title="Gallery"
      description="Photos already in the portfolio. Editing one saves the change to the “Add photo data” pull request, where it waits in Photos in Flight until it merges."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <PublishedPhotos />
          ) : (
            <Card>
              <CardContent>
                <p className="text-muted-foreground">
                  Not set up: add the GitHub repository and token in{" "}
                  <Link to="/settings" className="text-foreground underline underline-offset-4">
                    Settings
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          )
        }
      </QueryResult>
    </Page>
  );
}

/** Which photos are chosen to add albums and tags to, by path; null when not choosing. */
type Selection = ReadonlySet<string> | null;

function PublishedPhotos() {
  const published = useQuery(publishedPhotosQuery);
  const [filter, setFilter] = useState("");
  const selection = useSelection();
  const shown = published.data ? shownFiles(published.data, filter) : [];
  return (
    <>
      <GalleryHeader
        published={published}
        filter={filter}
        onFilterChange={setFilter}
        selecting={selection.selected !== null}
        onSelectingChange={selection.toggleSelecting}
      />
      {selection.selected && published.data && (
        <BulkGroupsCard
          files={published.data.files}
          shown={shown}
          selection={selection.selected}
          onSelectionChange={selection.setSelected}
        />
      )}
      <QueryResult query={published} pendingLabel="Reading the portfolio's photos from GitHub…">
        {(data) => (
          <PhotoGrid
            data={data}
            shown={shown}
            filter={filter}
            selection={selection.selected}
            onToggle={selection.toggle}
          />
        )}
      </QueryResult>
    </>
  );
}

/** The photos chosen to add albums and tags to, and turning choosing them on and off. */
function useSelection() {
  const [selected, setSelected] = useState<Selection>(null);
  return {
    selected,
    setSelected,
    toggleSelecting: () => setSelected((current) => (current ? null : new Set())),
    toggle: (path: string) => setSelected((current) => current && toggled(current, path)),
  };
}

/** selection with path added, or taken out when it's there. */
function toggled(selection: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const next = new Set(selection);
  if (!next.delete(path)) next.add(path);
  return next;
}

interface GalleryHeaderProps {
  published: UseQueryResult<PublishedResponse>;
  filter: string;
  onFilterChange: (filter: string) => void;
  selecting: boolean;
  onSelectingChange: () => void;
}

function GalleryHeader({
  published,
  filter,
  onFilterChange,
  selecting,
  onSelectingChange,
}: GalleryHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio photos</CardTitle>
        <CardDescription>
          {published.data
            ? `${published.data.repo}, JSON in ${published.data.folder} on ${published.data.branch}`
            : "Reading the photo JSON on the base branch."}
        </CardDescription>
        <CardAction className="flex gap-2">
          <SelectButton on={selecting} disabled={!published.data} onClick={onSelectingChange} />
          <Button
            variant="outline"
            size="sm"
            disabled={published.isFetching}
            onClick={() => void published.refetch()}
          >
            {published.isFetching && <Spinner />}
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {published.data && <Summary data={published.data} />}
        <label className="relative block max-w-sm">
          <span className="sr-only">Filter photos</span>
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Filter by title or file name"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="pl-9"
          />
        </label>
      </CardContent>
    </Card>
  );
}

/** Turns choosing photos to add albums and tags to on, or off when it's on. */
function SelectButton({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={on ? "default" : "outline"}
      size="sm"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {on ? <CheckIcon /> : <ListChecksIcon />}
      {on ? "Done" : "Select"}
    </Button>
  );
}

/** The photos to show, newest first, that match filter. */
function shownFiles(data: PublishedResponse, filter: string): PublishedFile[] {
  return sortedNewestFirst(data.files).filter((file) => matches(file, filter));
}

/** Why the photo can't have albums and tags added from here, or undefined when it can. */
function selectProblem(file: PublishedFile): string | undefined {
  if (file.error) return "Its JSON couldn't be read.";
  if (file.inFlight === "removed") return "It's removed in the pull request.";
  return undefined;
}

interface BulkGroupsCardProps {
  files: PublishedFile[];
  /** The photos the filter shows, which "Select all" chooses. */
  shown: PublishedFile[];
  selection: ReadonlySet<string>;
  onSelectionChange: (selection: ReadonlySet<string>) => void;
}

/**
 * Adds albums and tags to every chosen photo, as one commit in the photo data pull request. Each
 * photo keeps the ones it has.
 */
function BulkGroupsCard({ files, shown, selection, onSelectionChange }: BulkGroupsCardProps) {
  const [groups, setGroups] = useState<PhotoGroups>(NO_GROUPS);
  const { add, rebuild } = useBulkAdd(() => {
    onSelectionChange(new Set());
    setGroups(NO_GROUPS);
  });
  const chosen = files.filter((file) => selection.has(file.path));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add albums and tags</CardTitle>
        <CardDescription>
          Choose photos below, then the albums and tags to add to them. Each photo keeps the ones it
          has, and the change goes into the photo data pull request as one commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <SelectionBar
          chosen={chosen.length}
          shown={shown}
          selection={selection}
          onSelectionChange={onSelectionChange}
        />
        <PhotoGroupFields
          idPrefix="bulk"
          value={groups}
          disabled={add.isPending}
          onChange={(next) => {
            add.reset();
            setGroups(next);
          }}
          albumWarning={alreadyInAlbum(chosen, groups.albums)}
        />
        <Button
          className="self-start"
          disabled={!canAdd(add.isPending, chosen.length, groups)}
          onClick={() => add.mutate({ paths: chosen.map((file) => file.path), ...groups })}
        >
          {add.isPending && <Spinner />}
          Add to {photoCount(chosen.length)}
        </Button>
        <BulkOutcome add={add} rebuild={rebuild} />
      </CardContent>
    </Card>
  );
}

function photoCount(n: number): string {
  return n === 1 ? "1 photo" : `${n} photos`;
}

function canAdd(pending: boolean, chosen: number, groups: PhotoGroups): boolean {
  return !pending && chosen > 0 && groups.albums.length + groups.tags.length > 0;
}

/** Adds albums and tags to photos, then reads the Gallery again and follows CI's rebuild. */
function useBulkAdd(onAdded: () => void) {
  const queryClient = useQueryClient();
  const rebuild = useAllPhotosRebuild(true, () => {});
  const add = useMutation({
    ...addPhotoGroupsMutation,
    onSuccess: () => {
      rebuild.afterPush();
      onAdded();
      void queryClient.invalidateQueries({ queryKey: publishedPhotosQuery.queryKey });
    },
  });
  return { add, rebuild };
}

type BulkAdd = ReturnType<typeof useBulkAdd>;

interface SelectionBarProps {
  chosen: number;
  shown: PublishedFile[];
  selection: ReadonlySet<string>;
  onSelectionChange: (selection: ReadonlySet<string>) => void;
}

/** How many photos are chosen, with buttons to choose every one shown or none. */
function SelectionBar({ chosen, shown, selection, onSelectionChange }: SelectionBarProps) {
  const selectable = shown.filter((file) => !selectProblem(file));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium" aria-live="polite">
        {photoCount(chosen)} chosen
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={selectable.length === 0}
        onClick={() => onSelectionChange(new Set([...selection, ...selectable.map((f) => f.path)]))}
      >
        Select all shown
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={selection.size === 0}
        onClick={() => onSelectionChange(new Set())}
      >
        Clear
      </Button>
    </div>
  );
}

/** A warning when adding albums would put chosen photos already in another one in more than one. */
function alreadyInAlbum(chosen: PublishedFile[], adding: string[]): ReactNode {
  const count = chosen.filter((file) => hasOtherAlbum(file, adding)).length;
  if (adding.length === 0 || count === 0) return undefined;
  return <AlreadyInAlbum count={count} />;
}

function hasOtherAlbum(file: PublishedFile, adding: string[]): boolean {
  return savedGroups(fileData(file)).albums.some((id) => !adding.includes(id));
}

function AlreadyInAlbum({ count }: { count: number }) {
  return (
    <Warning>
      {photoCount(count)} you chose {count === 1 ? "is" : "are"} already in an album, so this puts{" "}
      {count === 1 ? "it" : "them"} in more than one.
    </Warning>
  );
}

/** What adding the albums and tags did, or why it failed. */
function BulkOutcome({ add, rebuild }: BulkAdd) {
  if (add.isError) return <p className="text-destructive">{add.error.message}</p>;
  if (!add.isSuccess) return null;
  const result = add.data;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          Added them to {photoCount(result.files)} in{" "}
          <a
            href={result.commitUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            one commit
          </a>{" "}
          {result.newPullRequest ? "in a new pull request," : "to"}{" "}
          <a
            href={result.pullRequestUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            #{result.pullRequestNumber}
          </a>
          . They wait in Photos in Flight until it merges.
        </span>
      </p>
      <AllPhotosRebuild status={rebuild.status} />
    </div>
  );
}

function fileData(file: PublishedFile): Record<string, unknown> | undefined {
  const data = file.data;
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
}

/** How many photos there are, and how many of them have changes waiting in the pull request. */
function Summary({ data }: { data: PublishedResponse }) {
  const count = data.files.length;
  return (
    <p className="text-muted-foreground">
      {count === 1 ? "1 photo" : `${count} photos`}
      <InFlightCount data={data} />
      {!data.images.checked && `. ${data.images.message ?? "Couldn't check R2."}`}
    </p>
  );
}

/** How many of the photos the pull request changes, linked to it, when it changes any. */
function InFlightCount({ data }: { data: PublishedResponse }) {
  const inFlight = data.files.filter((file) => file.inFlight).length;
  if (!data.pullRequest || inFlight === 0) return null;
  return (
    <>
      ; {inFlight} with changes in{" "}
      <a
        href={data.pullRequest.url}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline underline-offset-4"
      >
        #{data.pullRequest.number}
      </a>
    </>
  );
}

interface PhotoGridProps {
  data: PublishedResponse;
  shown: PublishedFile[];
  filter: string;
  selection: Selection;
  onToggle: (path: string) => void;
}

function PhotoGrid({ data, shown, filter, selection, onToggle }: PhotoGridProps) {
  if (data.files.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        No photo JSON on {data.branch} yet. Photos show here once their pull request merges.
      </p>
    );
  }
  if (shown.length === 0) {
    return <p className="text-muted-foreground text-sm">No photos match “{filter.trim()}”.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:gap-4">
      {shown.map((file) => (
        <li key={file.path}>
          <PhotoCard
            file={file}
            images={data.images}
            selected={selection ? selection.has(file.path) : null}
            onToggle={() => onToggle(file.path)}
          />
        </li>
      ))}
    </ul>
  );
}

interface PhotoCardProps {
  file: PublishedFile;
  images: InFlightImages;
  /** Whether the photo is chosen; null when photos aren't being chosen. */
  selected: boolean | null;
  onToggle: () => void;
}

function PhotoCard({ file, images, selected, onToggle }: PhotoCardProps) {
  const image = images.byPath[file.path];
  const name = photoName(file);
  const problem = editProblem(file, images);
  return (
    <article
      className={cn(
        "bg-card relative flex h-full flex-col overflow-hidden rounded-xl border",
        selected && "border-primary ring-primary ring-2",
      )}
    >
      <SelectBox file={file} name={name} selected={selected} onToggle={onToggle} />
      <SquareTile
        file={file}
        name={name}
        imageUrl={image?.url}
        onSelect={selectHandler(file, selected, onToggle)}
      />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium" title={name}>
            {name}
          </h2>
          <a
            href={file.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground block truncate font-mono text-xs underline-offset-4 hover:underline"
          >
            {fileName(file.path)}
          </a>
        </div>
        <GroupNames file={file} />
        <InFlightMark status={file.inFlight} />
        <div className="mt-auto flex items-center gap-2">
          {problem ? (
            <p className="text-muted-foreground text-xs">{problem}</p>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to="/exif" search={{ edit: file.path, from: "gallery" }}>
                <PencilIcon />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

/** While choosing photos, what clicking the tile does instead of opening the photo. */
function selectHandler(file: PublishedFile, selected: boolean | null, onToggle: () => void) {
  return selected !== null && !selectProblem(file) ? onToggle : undefined;
}

/**
 * While choosing photos, a checkbox over the tile's corner that chooses the photo, or says why it
 * can't be chosen.
 */
function SelectBox({
  file,
  name,
  selected,
  onToggle,
}: {
  file: PublishedFile;
  name: string;
  selected: boolean | null;
  onToggle: () => void;
}) {
  if (selected === null) return null;
  const problem = selectProblem(file);
  return (
    <label
      className="bg-background/90 absolute top-2 left-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md border shadow-sm has-disabled:cursor-not-allowed has-disabled:opacity-60"
      title={problem ?? (selected ? "Chosen" : "Choose this photo")}
    >
      <input
        type="checkbox"
        className="accent-primary size-4 cursor-pointer disabled:cursor-not-allowed"
        aria-label={`Choose ${name}`}
        checked={selected}
        disabled={Boolean(problem)}
        onChange={onToggle}
      />
    </label>
  );
}

/** The names of the albums and tags the photo's JSON lists, as the base branch has it. */
function GroupNames({ file }: { file: PublishedFile }) {
  const organize = useQuery(organizeQuery);
  const { albums, tags } = savedGroups(fileData(file));
  return (
    <div className="text-muted-foreground flex flex-col gap-0.5 text-xs empty:hidden">
      <GroupLine
        label={albums.length > 1 ? "Albums" : "Album"}
        names={groupNames(organize.data, "albums", albums)}
      />
      <GroupLine label="Tags" names={groupNames(organize.data, "tags", tags)} />
    </div>
  );
}

/** The names of the albums or tags with ids, or the IDs of ones that aren't read or found. */
function groupNames(data: OrganizeResponse | undefined, kind: GroupKind, ids: string[]): string[] {
  const groups = data ? data[kind] : [];
  const names = new Map(groups.map((group) => [group.id, groupLabel(group)]));
  return ids.map((id) => names.get(id) ?? id);
}

function GroupLine({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  const text = names.join(", ");
  return (
    <p className="truncate" title={text}>
      <span className="text-foreground">{label}:</span> {text}
    </p>
  );
}

/** Why the photo can't be opened on the Photo page, or undefined when it can. */
function editProblem(file: PublishedFile, images: InFlightImages): string | undefined {
  if (file.error) return file.error;
  if (file.inFlight === "removed") return "Removed in the pull request.";
  return imageProblem(file, images);
}

/** Why the photo has no image in R2 to edit from, or undefined when it has one. */
function imageProblem(file: PublishedFile, images: InFlightImages): string | undefined {
  if (images.byPath[file.path]) return undefined;
  return images.checked ? "No image in R2 to edit from." : "Couldn't check R2 for its image.";
}

const IN_FLIGHT_LABELS: Record<string, string> = {
  removed: "Removed in flight",
};

/** A note, linked to Photos in Flight, when the pull request changes the photo. */
function InFlightMark({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <Link
      to="/in-flight"
      className={cn(
        "flex w-fit items-center gap-1 text-xs underline-offset-4 hover:underline",
        status === "removed" ? "text-destructive" : "text-amber-700 dark:text-amber-400",
      )}
    >
      <GitPullRequestArrowIcon className="size-3.5" aria-hidden />
      {IN_FLIGHT_LABELS[status] ?? "Changes in flight"}
    </Link>
  );
}

/** The photo's Square Thumbnail, over its blurred Thumbnail Preview, opening the photo full size. */
function SquareTile({
  file,
  name,
  imageUrl,
  onSelect,
}: {
  file: PublishedFile;
  name: string;
  imageUrl?: string;
  /** Called instead of opening the photo, while photos are being chosen. */
  onSelect?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const urls = tileUrls(file, imageUrl);
  if (!urls || failed) return <MissingTile />;
  const { className, ...button } = tileButton(onSelect, () => setOpen(true));
  return (
    <>
      <button
        type="button"
        {...button}
        className={cn(
          "focus-visible:ring-ring bg-muted relative aspect-square w-full overflow-hidden border-b outline-none focus-visible:ring-2 focus-visible:ring-inset",
          className,
        )}
      >
        <img
          src={urls.preview}
          alt=""
          aria-hidden
          // Photos uploaded before Thumbnail Previews don't have one, so it hides itself.
          onError={(e) => (e.currentTarget.hidden = true)}
          className="absolute inset-0 size-full scale-110 object-cover blur-md"
        />
        <img
          src={urls.square}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="relative size-full object-cover"
        />
      </button>
      <ImageLightbox
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        src={urls.full}
        description={`${name} at full size.`}
      />
    </>
  );
}

/** What the tile does when clicked: chooses the photo while choosing them, or else opens it. */
function tileButton(onSelect: (() => void) | undefined, onOpen: () => void) {
  if (!onSelect)
    return { title: "Show it full size", onClick: onOpen, className: "cursor-zoom-in" };
  // The checkbox over the corner is the control keyboards and screen readers use while choosing.
  return {
    title: "Choose or unchoose it",
    onClick: onSelect,
    tabIndex: -1,
    className: "cursor-pointer",
  };
}

function MissingTile() {
  return (
    <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 border-b text-xs">
      <ImageOffIcon className="size-6" aria-hidden />
      No image
    </div>
  );
}

/**
 * The tile's Square Thumbnail and Thumbnail Preview, as saved in the photo's JSON or else next to
 * its image in R2, and the image itself; undefined without an image in R2.
 */
function tileUrls(file: PublishedFile, imageUrl?: string) {
  if (!imageUrl) return undefined;
  return {
    square: savedImageUrl(file, "thumbnail") ?? squareThumbnailUrl(imageUrl),
    preview: savedImageUrl(file, "thumbnailpreview") ?? thumbnailPreviewUrl(imageUrl),
    full: imageUrl,
  };
}

function savedImageUrl(file: PublishedFile, name: string): string | undefined {
  const saved = (file.data as { images?: Record<string, unknown> } | undefined)?.images?.[name];
  return typeof saved === "string" && saved ? saved : undefined;
}

function savedString(file: PublishedFile, field: string): string | undefined {
  const value = (file.data as Record<string, unknown> | undefined)?.[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** What to call the photo: its title, or else its original file name. */
function photoName(file: PublishedFile): string {
  return savedString(file, "title") ?? file.photoName;
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Whether the photo's title or file names contain filter, ignoring case. */
function matches(file: PublishedFile, filter: string): boolean {
  const query = filter.trim().toLowerCase();
  if (!query) return true;
  return [photoName(file), file.photoName, fileName(file.path)].some((text) =>
    text.toLowerCase().includes(query),
  );
}

/** files by when each photo was taken, newest first, then ones without a date by path. */
function sortedNewestFirst(files: PublishedFile[]): PublishedFile[] {
  return files.toSorted((a, b) => {
    const da = savedString(a, "createDate") ?? "";
    const db = savedString(b, "createDate") ?? "";
    if (da !== db) return db.localeCompare(da);
    return a.path.localeCompare(b.path);
  });
}
