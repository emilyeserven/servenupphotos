import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { type StylePhoto, takenDay } from "@/lib/style-prompt";

/** The photos the style prompt links, numbered as the prompt numbers them. */
export function StylePhotos({ photos }: { photos: StylePhoto[] }) {
  if (photos.length === 0) {
    return <p className="text-muted-foreground text-sm">No photos match these filters.</p>;
  }
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
      {photos.map((photo, i) => {
        const title = typeof photo.data.title === "string" ? photo.data.title : "";
        return (
          <li key={photo.path} className="flex min-w-0 flex-col gap-1 text-xs">
            <PickedThumbnail data={photo.data} alt={title || photo.path} className="w-full" />
            <span className="text-muted-foreground truncate" title={title}>
              {i + 1}. {takenDay(photo.data) || "No date"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
