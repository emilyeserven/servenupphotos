import { shownImageUrl } from "@/lib/face-json";
import { Link } from "@tanstack/react-router";
import { CircleMinusIcon, ImageOffIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { type InFlightFile, type InFlightImages, type RemoveResult } from "@/api/photos";
import { CompareButton } from "@/components/compare/compare-button";
import { UnselectedMark } from "@/components/compare/unselected-mark";
import { DraftMark } from "@/components/draft-mark";
import { FallbackImage } from "@/components/fallback-image";
import { ImageLightbox } from "@/components/image-lightbox";
import { fileName } from "@/components/in-flight-checks";
import { AllPhotosMark, FileJson } from "@/components/in-flight-file-json";
import { FileLink, FileStatus } from "@/components/in-flight-pending";
import { ReEditMark } from "@/components/re-edit-card";
import { LowerTierMark } from "@/components/lower-tier";
import { ReEditButton } from "@/components/in-flight-page/re-edit-button";
import { RemoveFile } from "@/components/remove-in-flight-file";
import { SquareThumbnailImage } from "@/components/square-thumbnail-image";
import { Button } from "@/components/ui/button";
import { MoveToUndecided } from "@/components/undecided-photos";
import { offlineSmallUrl, squareImages } from "@/lib/offline-thumbnails";
import { savedTitle } from "@/lib/untitled-photos";
import { cn } from "@/lib/utils";

/** One photo in flight: its title row with its marks and actions, then its image beside its JSON. */
export function FileSection({
  file,
  images,
  rebuilding,
  baseBranch,
  onRemoved,
}: {
  file: InFlightFile;
  images: InFlightImages;
  /** Whether ALLPHOTOS.json is being committed, so a missing entry may be on its way. */
  rebuilding: boolean;
  /** The branch the pull request merges into, which changed files are compared against. */
  baseBranch?: string;
  onRemoved: (result: RemoveResult) => void;
}) {
  return (
    <section className="@container flex flex-col gap-2">
      <h2 className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
        <EditLink file={file} images={images} />
        <PhotoTitle file={file} />
        <FileLink fileUrl={file.fileUrl} name={fileName(file.path)} />
        <FileStatus status={file.status} pending={file.pending} />
        <UnselectedMark file={file}>
          <DraftMark data={file.status === "removed" ? undefined : file.data} path={file.path}>
            <AllPhotosMark inAllPhotos={file.inAllPhotos} rebuilding={rebuilding} />
          </DraftMark>
        </UnselectedMark>
        <ReEditMark data={file.status === "removed" ? undefined : file.data} />
        {file.status !== "removed" && <LowerTierMark file={file} />}
        <MoveToUndecided file={file} />
        <ReEditButton file={file} />
        <CompareButton file={file} />
        <RemoveFile file={file} images={images} onRemoved={onRemoved} />
      </h2>
      <div className="grid items-start gap-4 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PhotoImages file={file} images={images} />
        <FileJson file={file} baseBranch={baseBranch} />
      </div>
    </section>
  );
}

/** The photo's image from R2, with its Square Thumbnail under it when it has an image. */
function PhotoImages({ file, images }: { file: InFlightFile; images: InFlightImages }) {
  const url = images.byPath[file.path]?.url;
  const square = squareImages(file.data, url);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PhotoImage
        name={photoName(file)}
        url={url && shownImageUrl(file.data, url)}
        checked={images.checked}
      />
      {square && (
        <SquareThumbnailImage
          key={square.square}
          name={photoName(file)}
          url={square.square}
          previewUrl={square.preview}
        />
      )}
    </div>
  );
}

/** What to call the photo: its title, or else its original file name. */
function photoName(file: InFlightFile): string {
  return savedTitle(file) ?? file.photoName;
}

/** The photo's title, ahead of its JSON file's name, when it has one. */
function PhotoTitle({ file }: { file: InFlightFile }) {
  const title = savedTitle(file);
  return title ? <span className="text-base">{title}</span> : null;
}

/** Whether the file's photo can be opened on the Photo page: its JSON was read and its image is in R2. */
function canEdit(file: InFlightFile, imageUrl?: string): boolean {
  return Boolean(imageUrl) && !file.error && file.status !== "removed";
}

/**
 * Opens the photo on the Photo page, to change its Square Thumbnail crop; nothing when it can't be
 * opened there.
 */
function EditLink({ file, images }: { file: InFlightFile; images: InFlightImages }) {
  if (!canEdit(file, images.byPath[file.path]?.url)) return null;
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/exif" search={{ edit: file.path }}>
        <PencilIcon />
        Edit
      </Link>
    </Button>
  );
}

const MISSING_IMAGE = {
  missing: { Icon: CircleMinusIcon, label: "No image in R2", className: "text-destructive" },
  unchecked: { Icon: ImageOffIcon, label: "Couldn't check R2", className: "text-muted-foreground" },
};

/** The photo's image from R2 (its pixelated version once its faces are pixelated), opening full size in a lightbox, or a "do not enter" sign when it has none. */
function PhotoImage({ name, url, checked }: { name: string; url?: string; checked: boolean }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  if (url && !failed) {
    return (
      <>
        <button
          type="button"
          title="Show it full size"
          onClick={() => setOpen(true)}
          className="focus-visible:ring-ring cursor-zoom-in rounded-xl outline-none focus-visible:ring-2"
        >
          <FallbackImage
            src={url}
            fallback={offlineSmallUrl(url)}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="bg-muted max-h-[32rem] w-full rounded-xl border object-contain"
          />
        </button>
        <ImageLightbox
          open={open}
          onClose={() => setOpen(false)}
          title={name}
          src={url}
          description={`${name} at full size.`}
        />
      </>
    );
  }
  const { Icon, label, className } = MISSING_IMAGE[checked ? "missing" : "unchecked"];
  return (
    <div className="bg-muted/40 flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm">
      <Icon className={cn("size-10", className)} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground font-mono text-xs">{name}</span>
    </div>
  );
}
