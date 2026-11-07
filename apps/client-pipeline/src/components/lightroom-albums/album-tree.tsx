import { FolderIcon } from "lucide-react";
import { useState } from "react";
import { AlbumBoard } from "@/components/lightroom-albums/album-board";
import { AlbumTitle, StageSelect, Uncertain } from "@/components/lightroom-albums/album-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { count } from "@/components/update-data-shared";
import {
  LIGHTROOM_STAGES,
  type LightroomAlbum,
  type LightroomAlbumsFile,
  type LightroomFolder,
  type LightroomItem,
  type LightroomStage,
  allAlbums,
} from "@/lib/lightroom-albums";
import { cn } from "@/lib/utils";
import { type LightroomView, useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** Which albums the tree shows: every album, the ones without a stage, or the ones at one stage. */
type StageFilter = "all" | "none" | LightroomStage;

function matches(album: LightroomAlbum, filter: StageFilter): boolean {
  if (filter === "all") return true;
  return filter === "none" ? album.stage === null : album.stage === filter;
}

/** The items the filter shows, keeping a folder only when an album inside it is shown. */
function filterItems(items: LightroomItem[], filter: StageFilter): LightroomItem[] {
  if (filter === "all") return items;
  return items.flatMap((item): LightroomItem[] => {
    if (item.kind === "album") return matches(item, filter) ? [item] : [];
    const children = filterItems(item.children, filter);
    return children.length > 0 ? [{ ...item, children }] : [];
  });
}

/** The Albums card: the albums as Lightroom's folder tree or as a board with a lane per stage, each with its stage and notes. */
export function AlbumTreeCard() {
  const file = useLightroomAlbumsStore((state) => state.file);
  const albums = file ? allAlbums(file.items) : [];
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Albums</CardTitle>
          <CardDescription>{summary(file, albums)}</CardDescription>
        </div>
        {file && <ViewSwitch />}
      </CardHeader>
      {file && (
        <CardContent>
          <AlbumsView file={file} albums={albums} />
        </CardContent>
      )}
    </Card>
  );
}

/** How many albums there are, how many are offline, and when the list last changed. */
function summary(file: LightroomAlbumsFile | null, albums: LightroomAlbum[]) {
  if (!file) return "Nothing imported yet.";
  const offline = albums.filter((album) => album.offline).length;
  return `${count(albums.length, "album")}, ${offline} offline, last changed ${new Date(file.updatedAt).toLocaleString()}.`;
}

const VIEWS: { value: LightroomView; label: string }[] = [
  { value: "tree", label: "Tree" },
  { value: "board", label: "Board" },
];

/** Switches the Albums card between the tree and the board, remembered in the browser. */
function ViewSwitch() {
  const view = useLightroomAlbumsStore((state) => state.view);
  const setView = useLightroomAlbumsStore((state) => state.setView);
  return (
    <div className="flex rounded-md border p-0.5" role="group" aria-label="Show the albums as">
      {VIEWS.map((v) => (
        <button
          key={v.value}
          type="button"
          aria-pressed={view === v.value}
          onClick={() => setView(v.value)}
          className={cn(
            "rounded px-3 py-1 text-sm",
            view === v.value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/** The chosen view of the albums. */
function AlbumsView({ file, albums }: { file: LightroomAlbumsFile; albums: LightroomAlbum[] }) {
  const view = useLightroomAlbumsStore((state) => state.view);
  return view === "board" ? (
    <AlbumBoard albums={albums} />
  ) : (
    <TreeView file={file} albums={albums} />
  );
}

/** The folder tree, with the stage buttons above it that show only the albums at one stage. */
function TreeView({ file, albums }: { file: LightroomAlbumsFile; albums: LightroomAlbum[] }) {
  const [filter, setFilter] = useState<StageFilter>("all");
  return (
    <div className="flex flex-col gap-4">
      <StageChips albums={albums} filter={filter} onFilter={setFilter} />
      <ItemList items={filterItems(file.items, filter)} />
    </div>
  );
}

interface StageChipsProps {
  albums: LightroomAlbum[];
  filter: StageFilter;
  onFilter: (filter: StageFilter) => void;
}

/** A button for every stage with how many albums are at it, which shows only those albums. */
function StageChips({ albums, filter, onFilter }: StageChipsProps) {
  const chips: { value: StageFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "none", label: "No stage" },
    ...LIGHTROOM_STAGES.map((stage) => ({ value: stage, label: stage })),
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Show albums at a stage">
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          aria-pressed={filter === chip.value}
          onClick={() => onFilter(chip.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            filter === chip.value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {chip.label} · {albums.filter((album) => matches(album, chip.value)).length}
        </button>
      ))}
    </div>
  );
}

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

/** A folder that opens and closes, with what's inside it indented under it. */
function FolderRow({ folder }: { folder: LightroomFolder }) {
  return (
    <details open className="group">
      <summary className="flex cursor-pointer items-center gap-2 py-1 font-medium">
        <FolderIcon className="text-muted-foreground size-4" aria-hidden />
        {folder.name}
        <Uncertain note={folder.uncertainNote} />
        {folder.collapsed && (
          <span className="text-muted-foreground text-xs font-normal">
            (closed in the screenshots, so its albums weren&apos;t read)
          </span>
        )}
      </summary>
      <div className="mt-1 border-s ps-4">
        <ItemList items={folder.children} />
      </div>
    </details>
  );
}

/** An album's name and marks, with its stage and notes to change. */
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
      <StageSelect album={album} className="sm:w-40" />
    </div>
  );
}
