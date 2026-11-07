import { ArchiveXIcon } from "lucide-react";
import type { InFlightImages, PublishedFile } from "@/api/photos";
import { CollapsiblePanel, countOf } from "@/components/collapsible-panel";
import { DraftTile } from "@/components/undecided-photos";
import { Button } from "@/components/ui/button";
import { useCompareEdits } from "@/hooks/use-compare-groups";

/** Whether R2 was searched (or its offline copy read), so a draft missing from `byPath` has no image there. */
function imagesKnown(images: InFlightImages): boolean {
  return images.checked || images.offline === true;
}

/**
 * The drafts on the base branch that can't be edited because their image wasn't found in R2,
 * collapsed to their count: usually photos that lost in a compare group whose images were deleted
 * but that were never marked unselected. When R2 was searched, **Move all to Unselected Photos**
 * marks them, which takes them out of the drafts. Nothing while there are none.
 */
export function MissingImageDrafts({
  files,
  images,
}: {
  files: PublishedFile[];
  images: InFlightImages;
}) {
  if (files.length === 0) return null;
  return (
    <CollapsiblePanel
      title="Can't be edited"
      count={`${countOf(files.length, "draft")} without an image`}
    >
      {imagesKnown(images) ? <MoveAll files={files} /> : <NotSearched message={images.message} />}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {files.map((file) => (
          <DraftTile key={file.path} file={file} fromGallery />
        ))}
      </ul>
    </CollapsiblePanel>
  );
}

/** Why the drafts can't be edited when R2 was searched, and Move all to Unselected Photos. */
function MoveAll({ files }: { files: PublishedFile[] }) {
  const { setAsideMissing } = useCompareEdits();
  return (
    <>
      <p className="text-muted-foreground text-sm">
        Their images aren&apos;t in R2, usually because they lost in a compare group and had their
        images deleted. Moving them to Unselected Photos takes them out of the drafts.
      </p>
      <Button className="w-fit" size="sm" onClick={() => setAsideMissing(files)}>
        <ArchiveXIcon />
        Move all to Unselected Photos
      </Button>
    </>
  );
}

/** Why the drafts can't be edited while R2 couldn't be searched. */
function NotSearched({ message }: { message?: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      R2 couldn&apos;t be searched{message ? ` (${message})` : ""}, so their images aren&apos;t
      known. They can be edited once it can.
    </p>
  );
}
