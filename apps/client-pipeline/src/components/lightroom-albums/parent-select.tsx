import { albumFolder, type LightroomAlbum, type LightroomItem } from "@/lib/lightroom-albums";
import { folderPaths, pathTaken } from "@/lib/lightroom-tree";
import { cn } from "@/lib/utils";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** The select's value for "New folder…", which asks for a path. */
const NEW_FOLDER = "\u0000new";

/** Asks for a new folder's path, such as Travel/Korea, or undefined when nothing was typed. */
function askFolder(): string | undefined {
  return window.prompt("New folder, such as Travel/Korea:")?.trim() || undefined;
}

/** Why an album can't move into the folder: something there already has its name. */
function clash(items: LightroomItem[], folder: string, name: string): string | undefined {
  const path = folder ? `${folder}/${name}` : name;
  if (!pathTaken(items, path)) return undefined;
  return `${folder || "No parent"} already has something called “${name}”.`;
}

/**
 * Picks the folder an album is in: one that's there, No parent, or a new one typed as a path. Moving to a folder that
 * already has an album with the same name is refused with a message.
 */
export function ParentSelect({ album, className }: { album: LightroomAlbum; className?: string }) {
  const items = useLightroomAlbumsStore((state) => state.file?.items ?? []);
  const moveAlbum = useLightroomAlbumsStore((state) => state.moveAlbum);
  const move = (value: string) => {
    const folder = value === NEW_FOLDER ? askFolder() : value;
    if (folder === undefined) return;
    const message = clash(items, folder, album.name);
    if (message) window.alert(message);
    else moveAlbum(album.path, folder);
  };
  return (
    <select
      aria-label={`Parent of ${album.name}`}
      className={cn("border-input bg-background h-9 rounded-md border px-3 text-sm", className)}
      value={albumFolder(album)}
      onChange={(event) => move(event.target.value)}
    >
      <option value="">No parent</option>
      {folderPaths(items).map((path) => (
        <option key={path} value={path}>
          {path}
        </option>
      ))}
      <option value={NEW_FOLDER}>New folder…</option>
    </select>
  );
}
