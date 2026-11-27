import type { CombinedData } from "@/api/photos";
import { bookAlbums } from "@/components/photo-book/album-photos";
import { AlbumSelect } from "@/components/photo-book/album-select";
import { MinPpiField } from "@/components/printing/min-ppi-field";
import { PrintSizePicker } from "@/components/printing/print-size-picker";
import { QueueCard } from "@/components/printing/queue-card";
import { queuePhotos } from "@/components/printing/queue-photos";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent } from "@/components/ui/card";
import { currentPhotos } from "@/lib/group-photos";
import type { BookAlbum } from "@/lib/photo-book-album";
import { useCombinedData } from "@/stores/combined-data";
import { printQueueAlbum } from "@/stores/printing";
import { EmptyNote } from "@portfolio/components/empty-note";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

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
        <MinPpiField />
      </CardContent>
    </Card>
  );
}
