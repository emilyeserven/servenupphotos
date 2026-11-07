import { AlbumTitle } from "@/components/lightroom-albums/album-parts";
import { Segmented } from "@/components/lightroom-albums/segmented";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LightroomAlbum, albumFolder, allAlbums } from "@/lib/lightroom-albums";
import {
  type LightroomConnection,
  NEXT_UP_STAGES,
  topAtStage,
  topOverall,
} from "@/lib/lightroom-next-up";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

const CONNECTIONS: { value: LightroomConnection; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];

/**
 * Next up: the 3 albums to work on next overall and at each stage, from every album that isn't Done, or only the
 * ones Lightroom keeps offline when Offline is picked.
 */
export function NextUpCard() {
  const file = useLightroomAlbumsStore((state) => state.file);
  const connection = useLightroomAlbumsStore((state) => state.connection);
  const setConnection = useLightroomAlbumsStore((state) => state.setConnection);
  if (!file) return null;
  const albums = allAlbums(file.items);
  const offline = connection === "offline";
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Next up</CardTitle>
          <CardDescription>
            Albums furthest along come first, so started ones get finished, then the ones with fewer
            photos. {offline && "Only albums kept offline are suggested."}
          </CardDescription>
        </div>
        <Segmented
          label="Internet"
          options={CONNECTIONS}
          value={connection}
          onChange={setConnection}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <TopList
          title="Overall"
          albums={topOverall(albums, connection)}
          offline={offline}
          showStage
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NEXT_UP_STAGES.map((stage) => (
            <TopList
              key={stage ?? "none"}
              title={stage ?? "No stage"}
              albums={topAtStage(albums, connection, stage)}
              offline={offline}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface TopListProps {
  title: string;
  albums: LightroomAlbum[];
  /** Whether each album says its stage, for the Overall list, which mixes stages. */
  showStage?: boolean;
  /** Whether only offline albums are suggested, so their Offline marks are left out. */
  offline: boolean;
}

/** A numbered list of up to 3 albums, or a line saying there are none. */
function TopList({ title, albums, showStage = false, offline }: TopListProps) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {albums.length === 0 && (
        <p className="text-muted-foreground text-sm">Nothing to work on here.</p>
      )}
      <ol className="flex flex-col gap-1.5">
        {albums.map((album, i) => (
          <TopAlbum
            key={album.path}
            album={album}
            place={i + 1}
            showStage={showStage}
            offline={offline}
          />
        ))}
      </ol>
    </section>
  );
}

interface TopAlbumProps {
  album: LightroomAlbum;
  place: number;
  showStage: boolean;
  offline: boolean;
}

/** One suggested album: its place, name and marks, and its folder (and stage, in the Overall list). */
function TopAlbum({ album, place, showStage, offline }: TopAlbumProps) {
  const stage = showStage ? (album.stage ?? "No stage") : "";
  const where = [stage, albumFolder(album)].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start gap-2 rounded-md border p-2">
      <span className="text-muted-foreground w-4 text-sm tabular-nums">{place}</span>
      <div className="min-w-0 flex-1">
        <AlbumTitle album={album} hideOffline={offline} />
        {where && <p className="text-muted-foreground truncate text-xs">{where}</p>}
      </div>
    </li>
  );
}
