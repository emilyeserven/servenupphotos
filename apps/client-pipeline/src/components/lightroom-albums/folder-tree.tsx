import { ChevronRightIcon, FolderIcon } from "lucide-react";
import { AlbumTitle, StageSelect, Uncertain } from "@/components/lightroom-albums/album-parts";
import { ParentSelect } from "@/components/lightroom-albums/parent-select";
import { RemoveAlbumButton } from "@/components/lightroom-albums/remove-album";
import { RemoveFolderButton } from "@/components/lightroom-albums/remove-folder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { count } from "@/components/update-data-shared";
import {
  type LightroomAlbum,
  type LightroomFolder,
  type LightroomItem,
  allAlbums,
} from "@/lib/lightroom-albums";
import { folderPaths } from "@/lib/lightroom-tree";
import { cn } from "@/lib/utils";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** The path that opens and closes the No Parent group, which no real folder can have. */
const NO_PARENT = "\u0000no-parent";

/** The top level of the tree: its folders, then the albums with no parent grouped under "No Parent". */
function grouped(items: LightroomItem[]): LightroomItem[] {
  const loose = items.filter((item) => item.kind === "album");
  const folders = items.filter((item) => item.kind === "folder");
  if (loose.length === 0) return folders;
  return [
    ...folders,
    { kind: "folder", name: "No Parent", path: NO_PARENT, children: loose, collapsed: false },
  ];
}

/** Every folder that can be opened and closed, the No Parent group too. */
function closablePaths(items: LightroomItem[]): string[] {
  return folderPaths(grouped(items));
}

interface AlbumTreeProps {
  items: LightroomItem[];
  /** Shows every folder open, such as while searching, without changing which ones are remembered as closed. */
  openAll?: boolean;
}

/** The whole tree, with the albums that have no parent grouped under "No Parent" after the folders. */
export function AlbumTree({ items, openAll = false }: AlbumTreeProps) {
  return <ItemList items={grouped(items)} openAll={openAll} />;
}

/** Opens or closes every folder in the tree at once. */
export function FolderButtons({ items }: { items: LightroomItem[] }) {
  const setClosedFolders = useLightroomAlbumsStore((state) => state.setClosedFolders);
  if (closablePaths(items).length === 0) return null;
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => setClosedFolders([])}>
        Expand all
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setClosedFolders(closablePaths(items))}
      >
        Collapse all
      </Button>
    </div>
  );
}

/** The folders and albums at one level of the tree, with what's inside each open folder under it. */
function ItemList({ items, openAll }: { items: LightroomItem[]; openAll: boolean }) {
  if (items.length === 0) return <p className="text-muted-foreground text-sm">No albums here.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.path}>
          {item.kind === "folder" ? (
            <FolderRow folder={item} openAll={openAll} />
          ) : (
            <AlbumRow album={item} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Whether a folder shows open: always while `openAll`, otherwise unless it's remembered as closed. */
function useFolderOpen(path: string, openAll: boolean): boolean {
  const remembered = useLightroomAlbumsStore((state) => !state.closedFolders.includes(path));
  return openAll || remembered;
}

/**
 * A folder that opens and closes from its name, remembered in the browser, with a button that deletes it and what's
 * inside it indented under it.
 */
function FolderRow({ folder, openAll }: { folder: LightroomFolder; openAll: boolean }) {
  const open = useFolderOpen(folder.path, openAll);
  const toggleFolder = useLightroomAlbumsStore((state) => state.toggleFolder);
  return (
    <div>
      <div className="group/row flex items-start gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggleFolder(folder.path)}
          className="hover:bg-muted flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md py-1 pe-2 text-start font-medium"
        >
          <ChevronRightIcon
            className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-90")}
            aria-hidden
          />
          <FolderIcon className="text-muted-foreground size-4" aria-hidden />
          <span className={cn(folder.path === NO_PARENT && "italic")}>{folder.name}</span>
          <span className="text-muted-foreground text-xs font-normal">
            {count(allAlbums(folder.children).length, "album")}
          </span>
          <Uncertain note={folder.uncertainNote} />
          <ClosedInLightroom folder={folder} />
        </button>
        <RemoveFolderButton path={folder.path} />
      </div>
      {open && (
        <div className="mt-1 ms-2 border-s ps-4">
          <ItemList items={folder.children} openAll={openAll} />
        </div>
      )}
    </div>
  );
}

/** Says the folder was closed in the screenshots or recording, so its albums weren't read. */
function ClosedInLightroom({ folder }: { folder: LightroomFolder }) {
  if (!folder.collapsed) return null;
  return (
    <span className="text-muted-foreground text-xs font-normal">
      (closed in the screenshots, so its albums weren&apos;t read)
    </span>
  );
}

/** An album's name and marks, with its stage, parent and notes to change, and a Remove button. */
function AlbumRow({ album }: { album: LightroomAlbum }) {
  const setAlbum = useLightroomAlbumsStore((state) => state.setAlbum);
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <AlbumTitle album={album} />
        <Textarea
          aria-label={`Notes on ${album.name}`}
          placeholder="Notes"
          value={album.notes}
          className="min-h-9 text-sm"
          onChange={(event) => setAlbum(album.path, { notes: event.target.value })}
        />
      </div>
      <div className="flex gap-2 sm:flex-col">
        <StageSelect album={album} className="flex-1 sm:w-44 sm:flex-none" />
        <ParentSelect album={album} className="flex-1 sm:w-44 sm:flex-none" />
        <RemoveAlbumButton album={album} />
      </div>
    </div>
  );
}
