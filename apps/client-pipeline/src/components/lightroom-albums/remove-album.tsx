import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LightroomAlbum } from "@/lib/lightroom-albums";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** What the Remove button asks first; an album read from Lightroom comes back with the next import that has it. */
function question(album: LightroomAlbum): string {
  const ask = `Remove “${album.name}”, with its stage and notes?`;
  if (album.manual) return ask;
  return `${ask} It comes back the next time you import a list that still has it, so remove it in Lightroom too.`;
}

interface RemoveAlbumButtonProps {
  album: LightroomAlbum;
  /** Shows only the bin, for a small card such as the board's. */
  iconOnly?: boolean;
}

/** Removes an album from the list, after asking, whether it was read from Lightroom or added by hand. */
export function RemoveAlbumButton({ album, iconOnly = false }: RemoveAlbumButtonProps) {
  const removeAlbum = useLightroomAlbumsStore((state) => state.removeAlbum);
  const remove = () => {
    if (window.confirm(question(album))) removeAlbum(album.path);
  };
  if (iconOnly) {
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Remove ${album.name}`}
        title="Remove"
        onClick={remove}
      >
        <Trash2Icon />
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" variant="ghost" onClick={remove}>
      <Trash2Icon />
      Remove
    </Button>
  );
}
