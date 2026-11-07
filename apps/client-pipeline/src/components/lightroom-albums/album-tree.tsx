import { FolderIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { count } from "@/components/update-data-shared";
import {
  LIGHTROOM_STAGES,
  type LightroomAlbum,
  type LightroomFolder,
  type LightroomItem,
  type LightroomStage,
  allAlbums,
} from "@/lib/lightroom-albums";
import { cn } from "@/lib/utils";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

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

/** The Albums card: how many albums are at each stage, and the folder tree with each album's stage and notes. */
export function AlbumTreeCard() {
  const file = useLightroomAlbumsStore((state) => state.file);
  const [filter, setFilter] = useState<StageFilter>("all");
  const albums = file ? allAlbums(file.items) : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Albums</CardTitle>
        <CardDescription>
          {file
            ? `${count(albums.length, "album")}, last changed ${new Date(file.updatedAt).toLocaleString()}.`
            : "Nothing imported yet."}
        </CardDescription>
      </CardHeader>
      {file && (
        <CardContent className="flex flex-col gap-4">
          <StageChips albums={albums} filter={filter} onFilter={setFilter} />
          <ItemList items={filterItems(file.items, filter)} />
        </CardContent>
      )}
    </Card>
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

/** An album's name and photo count, with its stage and notes to change. */
function AlbumRow({ album }: { album: LightroomAlbum }) {
  const setAlbum = useLightroomAlbumsStore((state) => state.setAlbum);
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {album.name}
          {album.smart && <span className="text-muted-foreground text-xs">Smart</span>}
          {album.photoCount !== null && (
            <span className="text-muted-foreground text-xs">
              {count(album.photoCount, "photo")}
            </span>
          )}
          <Uncertain note={album.uncertainNote} />
        </p>
        <Textarea
          aria-label={`Notes on ${album.name}`}
          placeholder="Notes"
          value={album.notes}
          className="min-h-9 text-sm"
          onChange={(event) => setAlbum(album.path, { notes: event.target.value })}
        />
      </div>
      <select
        aria-label={`Stage of ${album.name}`}
        className="border-input bg-background h-9 rounded-md border px-3 text-sm sm:w-40"
        value={album.stage ?? ""}
        onChange={(event) =>
          setAlbum(album.path, { stage: (event.target.value || null) as LightroomStage | null })
        }
      >
        <option value="">No stage</option>
        {LIGHTROOM_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A warning icon saying why the LLM wasn't sure it read the name right. */
function Uncertain({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-xs font-normal">
      <TriangleAlertIcon className="size-3.5" aria-hidden />
      {note}
    </span>
  );
}
