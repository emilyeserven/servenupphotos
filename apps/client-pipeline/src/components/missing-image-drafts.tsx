import { ArchiveXIcon, ChevronRightIcon } from "lucide-react";
import type { InFlightImages, PublishedFile } from "@/api/photos";
import { DraftTile } from "@/components/undecided-photos";
import { Button } from "@/components/ui/button";
import { useCompareEdits } from "@/hooks/use-compare-groups";

/** Whether R2 was searched (or its offline copy read), so a draft missing from `byPath` has no image there. */
export function imagesKnown(images: InFlightImages): boolean {
  return images.checked || images.offline === true;
}

/**
 * The drafts on the base branch whose image isn't in R2, collapsed to their count: usually photos
 * that lost in a compare group whose images were deleted but that were never marked unselected.
 * **Move all to Unselected Photos** marks them, which takes them out of the drafts. Nothing while
 * there are none.
 */
export function MissingImageDrafts({ files }: { files: PublishedFile[] }) {
  const { setAsideMissing } = useCompareEdits();
  if (files.length === 0) return null;
  return (
    <details className="group bg-card rounded-xl border shadow-sm">
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 rounded-xl px-6 py-4 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
        <span className="font-semibold">Not in R2</span>
        <span className="text-muted-foreground text-sm">
          {files.length} {files.length === 1 ? "draft" : "drafts"} without an image
        </span>
      </summary>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <p className="text-muted-foreground text-sm">
          Drafts whose image isn&apos;t in R2, usually ones that lost in a compare group and had
          their images deleted. Moving them to Unselected Photos takes them out of the drafts.
        </p>
        <Button className="w-fit" size="sm" onClick={() => setAsideMissing(files)}>
          <ArchiveXIcon />
          Move all to Unselected Photos
        </Button>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((file) => (
            <DraftTile key={file.path} file={file} fromGallery />
          ))}
        </ul>
      </div>
    </details>
  );
}
