import { Trash2Icon } from "lucide-react";
import { SHOW_ON_HOVER } from "@/components/lightroom-albums/remove-album";
import { Button } from "@/components/ui/button";
import { count } from "@/components/update-data-shared";
import { allAlbums, type LightroomFolder } from "@/lib/lightroom-albums";
import { findFolder } from "@/lib/lightroom-tree";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/**
 * What the Delete button asks first: how many albums go with the folder, counted in the whole list rather than only
 * the ones a search shows, and that ones read from Lightroom come back with the next import that has them.
 */
function question(folder: LightroomFolder): string {
  const inside = allAlbums(folder.children);
  const ask = `Delete the folder “${folder.path}”`;
  if (inside.length === 0) return `${ask}?`;
  const fromLightroom = inside.some((album) => !album.manual)
    ? " Albums read from Lightroom come back the next time you import a list that still has them, so delete the folder in Lightroom too."
    : "";
  return `${ask} and the ${count(inside.length, "album")} in it, with their stages and notes?${fromLightroom}`;
}

/** Deletes a folder with every folder and album inside it, after asking. */
export function RemoveFolderButton({ path }: { path: string }) {
  const removeFolder = useLightroomAlbumsStore((state) => state.removeFolder);
  const folder = useLightroomAlbumsStore((state) => findFolder(state.file?.items ?? [], path));
  if (!folder) return null;
  const remove = () => {
    if (window.confirm(question(folder))) removeFolder(path);
  };
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      className={SHOW_ON_HOVER}
      aria-label={`Delete the folder ${folder.name}`}
      title="Delete folder"
      onClick={remove}
    >
      <Trash2Icon />
    </Button>
  );
}
