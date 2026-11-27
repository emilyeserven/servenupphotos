import { Link } from "@tanstack/react-router";
import type { CombinedData } from "@/api/photos";
import { bookAlbums } from "@/components/photo-book/album-photos";
import { AlbumSelect } from "@/components/photo-book/album-select";
import { PrintPhotoTile } from "@/components/printing/print-photo-tile";
import { PrintSizePicker } from "@/components/printing/print-size-picker";
import { queuePhotos } from "@/components/printing/queue-photos";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type CombinedPhoto, currentPhotos } from "@/lib/group-photos";
import type { BookAlbum } from "@/lib/photo-book-album";
import { photoKey } from "@/lib/print-queue";
import { useCombinedData } from "@/stores/combined-data";
import { printQueueAlbum } from "@/stores/printing";
import { EmptyNote } from "@portfolio/components/empty-note";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import { count } from "@portfolio/lib/words";

/**
 * The Print Queue page's content: the album used as the print queue, the print size, and the
 * queue's photos, each with how clear it prints at that size.
 */
export function PrintQueue() {
  const combined = useCombinedData();
  return (
    <QueryResult query={combined} pendingLabel="Reading the albums…">
      {(data) => <Queue data={data} />}
    </QueryResult>
  );
}

function Queue({ data }: { data: CombinedData }) {
  const albumId = printQueueAlbum.use();
  const albums = bookAlbums(data);
  const album = albums.find((a) => a.id === albumId);
  return (
    <>
      <QueueSettings albums={albums} albumId={albumId} />
      {album ? (
        <QueueCard
          album={album}
          photos={queuePhotos(currentPhotos(data)?.photos ?? [], albums, albumId)}
        />
      ) : (
        <EmptyNote>Choose an album to use as the print queue.</EmptyNote>
      )}
    </>
  );
}

/** The album picked as the print queue, and the print size its photos are checked at. */
function QueueSettings({ albums, albumId }: { albums: BookAlbum[]; albumId: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Print queue album</span>
          <AlbumSelect
            albums={albums}
            value={albumId}
            onChange={(id) => printQueueAlbum.set(id)}
            className={`${SELECT_CLASS} self-start`}
          />
          <span className="text-muted-foreground">
            Add photos to this album to queue them for printing. The choice is kept in this browser.
          </span>
        </label>
        <PrintSizePicker />
      </CardContent>
    </Card>
  );
}

/** The print queue album's photos, each with its print rating. */
function QueueCard({ album, photos }: { album: BookAlbum; photos: CombinedPhoto[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{album.name || album.id}</CardTitle>
        <CardDescription>
          {count(photos.length, "photo")} to print.{" "}
          <Link
            to="/albums/$id"
            params={{ id: album.id }}
            className="text-foreground underline underline-offset-4"
          >
            Open the album
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <EmptyNote>
            No photos in this album yet. Add some from the Gallery or the album's page.
          </EmptyNote>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {photos.map((photo) => (
              <li key={photoKey(photo)}>
                <PrintPhotoTile photo={photo} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
