import { type DragEvent, useState } from "react";
import { AlbumTitle, StageSelect } from "@/components/lightroom-albums/album-parts";
import { RemoveAlbumButton } from "@/components/lightroom-albums/remove-album";
import {
  LIGHTROOM_STAGES,
  type LightroomAlbum,
  type LightroomStage,
  albumFolder,
} from "@/lib/lightroom-albums";
import { cn } from "@/lib/utils";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

/** The drag's data type, carrying the dragged album's path. */
const ALBUM_PATH = "application/x-lightroom-album-path";

/** A lane: the albums at one stage, or the ones with no stage yet (null). */
const LANES: (LightroomStage | null)[] = [null, ...LIGHTROOM_STAGES];

/**
 * The board: a lane for each stage, left to right in the order work goes, with every album as a card in its
 * stage's lane. Dragging a card to another lane, or picking a stage on the card, moves it.
 */
export function AlbumBoard({ albums }: { albums: LightroomAlbum[] }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-w-max gap-3">
        {LANES.map((stage) => (
          <Lane
            key={stage ?? "none"}
            stage={stage}
            albums={albums.filter((album) => album.stage === stage)}
          />
        ))}
      </div>
    </div>
  );
}

interface LaneProps {
  stage: LightroomStage | null;
  albums: LightroomAlbum[];
}

/** One stage's column, which takes a card dropped on it. */
function Lane({ stage, albums }: LaneProps) {
  const setAlbum = useLightroomAlbumsStore((state) => state.setAlbum);
  const [over, setOver] = useState(false);
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const path = event.dataTransfer.getData(ALBUM_PATH);
    if (path) setAlbum(path, { stage });
  };
  return (
    <section
      aria-label={stage ?? "No stage"}
      className={cn(
        "bg-muted/40 flex w-52 shrink-0 flex-col gap-2 rounded-lg border p-2",
        over && "border-primary bg-primary/5",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <h3 className="flex items-center justify-between px-1 text-sm font-medium">
        {stage ?? "No stage"}
        <span className="text-muted-foreground text-xs">{albums.length}</span>
      </h3>
      {albums.map((album) => (
        <BoardCard key={album.path} album={album} />
      ))}
    </section>
  );
}

/** An album's card, dragged by its body, with its folder, notes, stage and a button that removes it. */
function BoardCard({ album }: { album: LightroomAlbum }) {
  const folder = albumFolder(album);
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(ALBUM_PATH, album.path);
        event.dataTransfer.effectAllowed = "move";
      }}
      className="group/row bg-background flex cursor-grab flex-col gap-1.5 rounded-md border p-2 shadow-xs active:cursor-grabbing"
    >
      <div className="flex items-start gap-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {folder && <p className="text-muted-foreground truncate text-xs">{folder}</p>}
          <AlbumTitle album={album} />
        </div>
        <RemoveAlbumButton album={album} iconOnly />
      </div>
      {album.notes && (
        <p className="text-muted-foreground line-clamp-3 text-xs whitespace-pre-line">
          {album.notes}
        </p>
      )}
      <StageSelect album={album} className="h-8 text-xs" />
    </article>
  );
}
