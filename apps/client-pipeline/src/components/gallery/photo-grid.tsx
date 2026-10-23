import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GitPullRequestArrowIcon, ImageOffIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { type InFlightImages, type PublishedFile, type PublishedResponse } from "@/api/photos";
import {
  type GroupKind,
  type OrganizeResponse,
  groupLabel,
  organizeQuery,
  savedGroups,
} from "@/api/organize";
import { squareThumbnailUrl, thumbnailPreviewUrl } from "@/api/versions";
import { DraftMark } from "@/components/draft-mark";
import { ImageLightbox } from "@/components/image-lightbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type Selection,
  fileData,
  fileName,
  photoName,
  selectProblem,
} from "@/components/gallery/published-file";

interface PhotoGridProps {
  data: PublishedResponse;
  shown: PublishedFile[];
  filter: string;
  selection: Selection;
  onToggle: (path: string) => void;
}

/** The photos shown, as Square Thumbnail tiles with their names, albums, tags and Edit buttons. */
export function PhotoGrid({ data, shown, filter, selection, onToggle }: PhotoGridProps) {
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
        <DraftMark data={file.data} />
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
          loading="lazy"
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
