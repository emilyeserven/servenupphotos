import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GitPullRequestArrowIcon } from "lucide-react";
import type { InFlightImages } from "@/api/photos";
import {
  type GroupKind,
  type OrganizeResponse,
  groupLabel,
  organizeQuery,
  savedGroups,
} from "@/api/organize";
import { CompareButton } from "@/components/compare/compare-button";
import { UnselectedMark } from "@/components/compare/unselected-mark";
import { DraftMark } from "@/components/draft-mark";
import { ReEditMark } from "@/components/re-edit-card";
import { LowerTierMark } from "@/components/lower-tier";
import { PlaceGpsMark } from "@/components/gallery/place-filter";
import { LikesMark, useLikeCounts } from "@/components/viewer-likes/likes-mark";
import { useRevealed } from "@/hooks/use-revealed";
import { cn } from "@/lib/utils";
import type { GalleryFile } from "@/components/gallery/gallery-files";
import { EditButton, tileId } from "@/components/gallery/kind-mark";
import { SquareTile } from "@/components/gallery/square-tile";
import {
  type Selection,
  fileData,
  fileName,
  selectProblem,
} from "@/components/gallery/published-file";

interface PhotoGridProps {
  /** The base branch the photos were read from, for when there are none. */
  branch: string;
  /** How many photos there are, shown or not. */
  total: number;
  /** The images found in R2, for whether R2 could be checked. */
  images: InFlightImages;
  shown: GalleryFile[];
  filter: string;
  selection: Selection;
  onToggle: (path: string) => void;
  /** The path of the photo `?photo=` names, ringed. */
  highlight?: string;
  /** Opens the photo full size in the Gallery's viewer. */
  onOpen: (path: string) => void;
}

/** What the photos were filtered by, when none match: the search text, or else the filters. */
function noMatch(filter: string): string {
  return filter.trim() ? `“${filter.trim()}”` : "the filters";
}

/**
 * The photos shown, as Square Thumbnail tiles with their names, albums, tags, genres and Edit
 * buttons, drawn a batch at a time as the page scrolls (`useRevealed`).
 */
export function PhotoGrid(props: PhotoGridProps) {
  const { shown, filter, selection, onToggle } = props;
  const likes = useLikeCounts();
  const [revealed, revealedEnd] = useRevealed(shown.length);
  // Draws at least up to the photo `?photo=` names, so it can be scrolled to.
  const revealedCount = Math.max(revealed, shown.findIndex((f) => f.path === props.highlight) + 1);
  if (props.total === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        No photo JSON on {props.branch} yet. Photos show here once they're saved.
      </p>
    );
  }
  if (shown.length === 0) {
    return <p className="text-muted-foreground text-sm">No photos match {noMatch(filter)}.</p>;
  }
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:gap-4">
        {shown.slice(0, revealedCount).map((file) => (
          <li key={file.path} id={tileId(file.path)} className="scroll-mt-24">
            <PhotoCard
              file={file}
              images={props.images}
              likes={likes}
              selected={selection ? selection.has(file.path) : null}
              onToggle={() => onToggle(file.path)}
              highlighted={file.path === props.highlight}
              onOpen={() => props.onOpen(file.path)}
            />
          </li>
        ))}
      </ul>
      <div ref={revealedEnd} aria-hidden />
    </>
  );
}

interface PhotoCardProps {
  file: GalleryFile;
  images: InFlightImages;
  /** How many people liked each photo on the User Likes page, by photo ID. */
  likes: Map<number, number>;
  /** Whether the photo is chosen; null when photos aren't being chosen. */
  selected: boolean | null;
  onToggle: () => void;
  /** Whether it's the photo `?photo=` names. */
  highlighted: boolean;
  onOpen: () => void;
}

function PhotoCard(props: PhotoCardProps) {
  const { file, images, likes, selected, onToggle } = props;
  const name = file.name;
  return (
    <article className={cardClass(file, selected, props.highlighted)}>
      <SelectBox file={file} name={name} selected={selected} onToggle={onToggle} />
      <SquareTile
        file={file}
        name={name}
        onSelect={selectHandler(file, selected, onToggle)}
        onOpen={props.onOpen}
      />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="truncate text-sm font-medium" title={name}>
              {name}
            </h2>
            <LikesMark data={editedObject(file)} counts={likes} />
          </div>
          <a
            href={file.fileUrl || undefined}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground block truncate font-mono text-xs underline-offset-4 hover:underline"
          >
            {fileName(file.path)}
          </a>
        </div>
        <GroupNames file={file} />
        <PlaceGpsMark file={file} />
        <InFlightMark status={file.inFlight} />
        <UnselectedMark file={file}>
          <DraftMark data={file.edited} />
        </UnselectedMark>
        <ReEditMark data={file.edited} />
        <LowerTierMark file={file} />
        <CardActions file={file} images={images} />
      </div>
    </article>
  );
}

/**
 * The tile's border: dashed for a photo that isn't published, ringed when it's chosen, and ringed
 * wider when it's the photo `?photo=` names.
 */
function cardClass(file: GalleryFile, selected: boolean | null, highlighted: boolean): string {
  return cn(
    "bg-card relative flex h-full flex-col overflow-hidden rounded-xl border transition-shadow",
    file.kind !== "published" && "border-dashed",
    selected && "border-primary ring-primary ring-2",
    highlighted && "ring-primary ring-offset-background ring-4 ring-offset-2",
  );
}

/** Edit, or why the photo can't be edited, and Compare. */
function CardActions({ file, images }: { file: GalleryFile; images: InFlightImages }) {
  const problem = editProblem(file, images);
  return (
    <div className="mt-auto flex flex-wrap items-center gap-2">
      {problem ? (
        <p className="text-muted-foreground text-xs">{problem}</p>
      ) : (
        <EditButton file={file} />
      )}
      <CompareButton file={file} />
    </div>
  );
}

/** While choosing photos, what clicking the tile does instead of opening the photo. */
function selectHandler(file: GalleryFile, selected: boolean | null, onToggle: () => void) {
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
  file: GalleryFile;
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

/** The names of the albums, tags and genres the photo's JSON lists, as the next Commit will save it. */
function GroupNames({ file }: { file: GalleryFile }) {
  const organize = useQuery(organizeQuery);
  const { albums, tags, genres } = savedGroups(editedObject(file));
  return (
    <div className="text-muted-foreground flex flex-col gap-0.5 text-xs empty:hidden">
      <GroupLine
        label={albums.length > 1 ? "Albums" : "Album"}
        names={groupNames(organize.data, "albums", albums)}
      />
      <GroupLine label="Tags" names={groupNames(organize.data, "tags", tags)} />
      <GroupLine label="Genres" names={groupNames(organize.data, "genres", genres)} />
    </div>
  );
}

/** The names of the albums, tags or genres with ids, or the IDs of ones that aren't read or found. */
function groupNames(data: OrganizeResponse | undefined, kind: GroupKind, ids: string[]): string[] {
  const groups = data?.[kind] ?? [];
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
function editProblem(file: GalleryFile, images: InFlightImages): string | undefined {
  if (file.error) return file.error;
  if (file.inFlight === "removed") return "Removed in the pull request.";
  return imageProblem(file, images);
}

/** Why the photo has no image in R2 to edit from, or undefined when it has one. */
function imageProblem(file: GalleryFile, images: InFlightImages): string | undefined {
  if (file.r2Url) return undefined;
  return images.checked ? "No image in R2 to edit from." : "Couldn't check R2 for its image.";
}

const IN_FLIGHT_LABELS: Record<string, string> = {
  removed: "Removed in flight",
  added: "New in flight",
};

/** A note, linked to Photos in Flight, when the pull request changes the photo. */
function InFlightMark({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <Link
      to="/in-flight"
      // oxlint-disable-next-line servenup/error-note -- red marks a photo the pull request removes
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

/** The photo's JSON with its local edits made, as an object, or undefined when it couldn't be read as one. */
function editedObject(file: GalleryFile): Record<string, unknown> | undefined {
  return fileData({ ...file, data: file.edited });
}
