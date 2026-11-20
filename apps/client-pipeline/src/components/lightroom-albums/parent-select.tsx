import { useState } from "react";
import { ErrorNote } from "@/components/error-note";
import { NewFolderDialog } from "@/components/lightroom-albums/new-folder-dialog";
import { albumFolder, type LightroomAlbum, type LightroomItem } from "@/lib/lightroom-albums";
import { folderPaths, pathTaken } from "@/lib/lightroom-tree";
import { cn } from "@/lib/utils";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** The select's value for "New folder…", which asks for a path. */
const NEW_FOLDER = "\u0000new";

/** Why an album can't move into the folder: something there already has its name. */
function clash(items: LightroomItem[], folder: string, name: string): string | undefined {
  const path = folder ? `${folder}/${name}` : name;
  if (!pathTaken(items, path)) return undefined;
  return `${folder || "No parent"} already has something called “${name}”.`;
}

/**
 * Picks the folder an album is in: one that's there, No parent, or a new one typed as a path in a
 * dialog. Moving to a folder that already has an album with the same name is refused with a
 * message under the select, or in the dialog.
 */
export function ParentSelect({ album, className }: { album: LightroomAlbum; className?: string }) {
  const items = useLightroomAlbumsStore((state) => state.file?.items ?? []);
  const moveAlbum = useLightroomAlbumsStore((state) => state.moveAlbum);
  const [naming, setNaming] = useState(false);
  const [problem, setProblem] = useState<string>();
  /** Moves the album, or answers why it can't. */
  const moveTo = (folder: string) => {
    const message = clash(items, folder, album.name);
    if (!message) moveAlbum(album.path, folder);
    return message;
  };
  const pick = (value: string) => {
    if (value === NEW_FOLDER) setNaming(true);
    else setProblem(moveTo(value));
  };
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <select
        aria-label={`Parent of ${album.name}`}
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        value={albumFolder(album)}
        onChange={(event) => pick(event.target.value)}
      >
        <option value="">No parent</option>
        {folderPaths(items).map((path) => (
          <option key={path} value={path}>
            {path}
          </option>
        ))}
        <option value={NEW_FOLDER}>New folder…</option>
      </select>
      <ErrorNote error={problem} className="text-xs" />
      <NewFolderDialog name={album.name} open={naming} onOpenChange={setNaming} onMove={moveTo} />
    </div>
  );
}
