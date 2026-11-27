import { useState } from "react";
import { PrintCheckCard } from "@/components/printing/print-check-card";
import { PrintPhotoTile } from "@/components/printing/print-photo-tile";
import { PrintSizePicker } from "@/components/printing/print-size-picker";
import { QueryResult } from "@/components/query-result";
import { SavedPhotoSearch } from "@/components/saved-photo-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type CombinedPhoto, currentPhotos } from "@/lib/group-photos";
import { photoKey, printPhotoName } from "@/lib/print-queue";
import { useCombinedData } from "@/stores/combined-data";
import { EmptyNote, NO_PHOTOS_MATCH } from "@portfolio/components/empty-note";

/**
 * The Print Quality page's content: the print size, the chosen photo's check, and every photo to
 * pick from, each with its rating at that size.
 */
export function PrintQuality({ chosen }: { chosen: string | undefined }) {
  const combined = useCombinedData();
  return (
    <>
      <Card>
        <CardContent>
          <PrintSizePicker />
        </CardContent>
      </Card>
      <QueryResult query={combined} pendingLabel="Reading the photos…">
        {(data) => <PhotoCheck photos={currentPhotos(data)?.photos ?? []} chosen={chosen} />}
      </QueryResult>
    </>
  );
}

function PhotoCheck({ photos, chosen }: { photos: CombinedPhoto[]; chosen: string | undefined }) {
  return (
    <>
      {chosen && <ChosenPhoto photos={photos} chosen={chosen} />}
      <PhotoPicker photos={photos} chosen={chosen} />
    </>
  );
}

/** The chosen photo's check, or a note when no photo has that file name. */
function ChosenPhoto({ photos, chosen }: { photos: CombinedPhoto[]; chosen: string }) {
  const photo = photos.find((p) => photoKey(p) === chosen);
  if (!photo) return <EmptyNote>No photo named {chosen} was found. Pick one below.</EmptyNote>;
  return <PrintCheckCard photo={photo} />;
}

/** Whether the photo's title or file name has the search text in it, ignoring case. */
function matches(photo: CombinedPhoto, search: string): boolean {
  const text = `${printPhotoName(photo)} ${photoKey(photo)}`.toLowerCase();
  return text.includes(search.trim().toLowerCase());
}

function PhotoPicker({ photos, chosen }: { photos: CombinedPhoto[]; chosen: string | undefined }) {
  const [search, setSearch] = useState("");
  const shown = photos.filter((photo) => matches(photo, search));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{chosen ? "Check another photo" : "Pick a photo"}</CardTitle>
        <CardDescription>Each photo shows how clear it prints at the size above.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SavedPhotoSearch value={search} onChange={setSearch} />
        {shown.length === 0 ? (
          <EmptyNote>{NO_PHOTOS_MATCH}</EmptyNote>
        ) : (
          <ul className="grid max-h-[60dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-6">
            {shown.map((photo) => (
              <li key={photoKey(photo)}>
                <PrintPhotoTile photo={photo} chosen={photoKey(photo) === chosen} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
