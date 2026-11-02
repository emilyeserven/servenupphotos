import { Link } from "@tanstack/react-router";
import { ImageIcon, TrophyIcon } from "lucide-react";
import { useId } from "react";
import { Combobox } from "@/components/ui/combobox";
import { type ComparePhoto, comparePhotoName } from "@/lib/compare-groups";
import { squareImages } from "@/lib/offline-thumbnails";
import { photoId } from "@/lib/unselected";

/** The photos with an ID, as options to pick winners from, by ID. */
function winnerOptions(photos: ComparePhoto[]) {
  return photos.flatMap((photo) => {
    const id = photoId(photo);
    if (id === undefined) return [];
    const file = photo.file.path.split("/").pop() ?? "";
    return [{ value: String(id), label: comparePhotoName(photo), detail: file, keywords: file }];
  });
}

interface UnselectedWinnersProps {
  /** The winners' photo IDs. */
  winners: number[];
  /** Every photo that can be compared, to find the winners in and pick more from. */
  photos: ComparePhoto[];
  onChange: (winners: number[]) => void;
}

/**
 * The photos chosen over an unselected one, as Square Thumbnails linked to each on the Photo page,
 * with a box to add or take out winners.
 */
export function UnselectedWinners({ winners, photos, onChange }: UnselectedWinnersProps) {
  const labelId = useId();
  const byId = new Map(photos.map((photo) => [photoId(photo), photo]));
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="flex items-center gap-1 text-xs font-medium">
        <TrophyIcon className="size-3.5 text-amber-600" aria-hidden />
        Chosen instead
      </span>
      {winners.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {winners.map((id) => (
            <li key={id}>
              <WinnerLink id={id} photo={byId.get(id)} />
            </li>
          ))}
        </ul>
      )}
      <Combobox
        aria-labelledby={labelId}
        options={winnerOptions(photos)}
        value={winners.map(String)}
        onChange={(value) => onChange(value.map(Number))}
        multiple
        placeholder="Add a photo that was chosen"
        emptyText="No photo matches."
        unknownLabel={(value) => `Photo ${value}, which isn't found`}
      />
    </div>
  );
}

/** Where the Photo page opens the photo, as the Gallery or Photos in Flight would. */
function editSearch(photo: ComparePhoto) {
  return photo.fromGallery
    ? { edit: photo.file.path, from: "gallery" as const }
    : { edit: photo.file.path };
}

/** A winner's Square Thumbnail and name, opening it on the Photo page; its ID when it isn't found. */
function WinnerLink({ id, photo }: { id: number; photo?: ComparePhoto }) {
  if (!photo) return <span className="text-muted-foreground text-xs">Photo {id}, not found</span>;
  const name = comparePhotoName(photo);
  const square = photo.imageUrl && squareImages(photo.data, photo.imageUrl);
  return (
    <Link
      to="/exif"
      search={editSearch(photo)}
      title={`Open ${name} on the Photo page`}
      className="hover:bg-muted flex w-28 flex-col gap-1 rounded-md p-1 text-xs"
    >
      <span className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-md border ring-2 ring-amber-500">
        {square ? (
          <img src={square.square} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageIcon className="text-muted-foreground size-5" aria-hidden />
        )}
      </span>
      <span className="truncate">{name}</span>
    </Link>
  );
}
