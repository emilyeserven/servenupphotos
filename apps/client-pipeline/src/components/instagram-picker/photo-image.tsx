import { ImageIcon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import { offlineImageUrl } from "@/lib/offline-thumbnails";

/** A photo's Square Thumbnail, or an icon when it has no image. */
export function PhotoImage({ photo }: { photo: SocialPhoto }) {
  if (!photo.image) {
    return (
      <span className="bg-muted text-muted-foreground flex size-full items-center justify-center">
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={offlineImageUrl(photo.image)}
      alt=""
      draggable={false}
      loading="lazy"
      className="size-full object-cover"
    />
  );
}
