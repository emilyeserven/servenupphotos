import type { ReactNode } from "react";
import { type SavedPhoto, SavedPhotoSquare } from "@/components/saved-photo-picker";

/** A similar photo's thumbnail and title, with its buttons, such as Remove, under it. */
export function SimilarTile({ photo, children }: { photo: SavedPhoto; children?: ReactNode }) {
  return (
    <li className="flex w-24 shrink-0 flex-col gap-1">
      <SavedPhotoSquare photo={photo} />
      <span className="truncate text-xs" title={photo.name}>
        {photo.name}
      </span>
      <div className="flex items-center gap-0.5">{children}</div>
    </li>
  );
}
