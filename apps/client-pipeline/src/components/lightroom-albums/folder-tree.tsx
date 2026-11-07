import { ChevronRightIcon, FolderIcon, Trash2Icon } from "lucide-react";
import { AlbumTitle, StageSelect, Uncertain } from "@/components/lightroom-albums/album-parts";
import { ParentSelect } from "@/components/lightroom-albums/parent-select";
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

/** The whole tree, with the albums that have no parent grouped under "No Parent" after the folders. */
export function AlbumTree({ items }: { items: LightroomItem[] }) {
  return <ItemList items={grouped(items)} />;
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
function ItemList({ items }: { items: LightroomItem[] }) {
  if (items.length === 0) return <p className="text-muted-foreground text-sm">No albums here.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.path}>
          {item.kind === "folder" ? <FolderRow folder={item} /> : <AlbumRow album={item} />}
        </li>
      ))}
    </ul>
  );
}

/** A folder that opens and closes from its name, remembered in the browser, with what's inside it indented under it. */
function FolderRow({ folder }: { folder: LightroomFolder }) {
  const open = useLightroomAlbumsStore((state) => !state.closedFolders.includes(folder.path));
  const toggleFolder = useLightroomAlbumsStore((state) => state.toggleFolder);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => toggleFolder(folder.path)}
        className="hover:bg-muted flex w-full flex-wrap items-center gap-2 rounded-md py-1 pe-2 text-start font-medium"
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
      {open && (
        <div className="mt-1 ms-2 border-s ps-4">
          <ItemList items={folder.children} />
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

/** An album's name and marks, with its stage and notes to change, and a Remove button when it was added by hand. */
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
        {album.manual && <RemoveButton album={album} />}
      </div>
    </div>
  );
}

/** Removes an album added by hand, after asking. */
function RemoveButton({ album }: { album: LightroomAlbum }) {
  const removeAlbum = useLightroomAlbumsStore((state) => state.removeAlbum);
  const remove = () => {
    if (confirm(`Remove “${album.name}”, with its stage and notes?`)) removeAlbum(album.path);
  };
  return (
    <Button type="button" size="sm" variant="ghost" onClick={remove}>
      <Trash2Icon />
      Remove
    </Button>
  );
}
