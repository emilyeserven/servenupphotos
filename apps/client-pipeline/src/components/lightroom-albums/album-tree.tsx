import { useState } from "react";
import { AlbumBoard } from "@/components/lightroom-albums/album-board";
import { AddAlbumButton } from "@/components/lightroom-albums/add-album";
import { FolderButtons, ItemList } from "@/components/lightroom-albums/folder-tree";
import { Segmented } from "@/components/lightroom-albums/segmented";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { count } from "@/components/update-data-shared";
import {
  LIGHTROOM_STAGES,
  type LightroomAlbum,
  type LightroomAlbumsFile,
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
        <div className="flex flex-wrap gap-2">
          <AddAlbumButton />
          {file && <ViewSwitch />}
        </div>
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
  if (!file) return "Nothing yet. Import your albums from Lightroom, or add them by hand.";
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
  return <Segmented label="Show the albums as" options={VIEWS} value={view} onChange={setView} />;
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <StageChips albums={albums} filter={filter} onFilter={setFilter} />
        <FolderButtons items={file.items} />
      </div>
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
