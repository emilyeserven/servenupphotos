import { Link } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";
import type { ComparePhoto } from "@/lib/compare-groups";
import { comparePhotoName } from "@/lib/compare-groups";
import { squareImages } from "@/lib/offline-thumbnails";

/** Where the Photo page opens the photo for editing, as the Gallery or Photos in Flight would. */
function editSearch(photo: ComparePhoto) {
  return photo.fromGallery
    ? { edit: photo.file.path, from: "gallery" as const }
    : { edit: photo.file.path };
}

/** A Dashboard tile: the photo's Square Thumbnail and name, opening it on the Photo page. */
export function DashboardPhotoTile({ photo, caption }: { photo: ComparePhoto; caption?: string }) {
  const square = photo.imageUrl && squareImages(photo.data, photo.imageUrl);
  const name = comparePhotoName(photo);
  return (
    <Link to="/exif" search={editSearch(photo)} className="group flex min-w-0 flex-col gap-1.5">
      <span className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-md border">
        {square ? (
          <img src={square.square} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageIcon className="text-muted-foreground size-5" aria-hidden />
        )}
      </span>
      <span className="truncate text-sm font-medium group-hover:underline" title={name}>
        {name}
      </span>
      {caption && <span className="text-muted-foreground -mt-1 text-xs">{caption}</span>}
    </Link>
  );
}
