import { Link } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";
import type { GalleryFile, PhotoKind } from "@/components/gallery/gallery-files";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The id of a photo's tile, which the jump box and `?photo=` scroll to. */
export function tileId(path: string): string {
  return `gallery-${path}`;
}

/** Scrolls the photo's tile to the middle of the window, when it's on the page. */
export function scrollToTile(path: string) {
  document.getElementById(tileId(path))?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** How each kind of photo that isn't published is marked on its tile, in the viewer and in the jump box. */
export const KIND_MARKS: Record<
  Exclude<PhotoKind, "published">,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-violet-600 text-white" },
  undecided: { label: "Undecided", className: "bg-amber-500 text-black" },
  lowerTier: { label: "Lower Tier", className: "bg-slate-600 text-white" },
};

/** "Draft", "Undecided" or "Lower Tier" over the tile's corner; nothing for a published photo. */
export function KindBadge({ kind, className }: { kind: PhotoKind; className?: string }) {
  if (kind === "published") return null;
  const mark = KIND_MARKS[kind];
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-2 right-2 rounded px-1.5 py-0.5 text-[0.7rem] font-medium shadow-sm",
        mark.className,
        className,
      )}
    >
      {mark.label}
    </span>
  );
}

/**
 * Opens the photo on the Photo page: the base branch's copy when it's only there, or else the
 * pull request's.
 */
export function EditButton({ file }: { file: GalleryFile }) {
  const search = file.onBase ? { edit: file.path, from: "gallery" as const } : { edit: file.path };
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/exif" search={search}>
        <PencilIcon />
        Edit
      </Link>
    </Button>
  );
}
