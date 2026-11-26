import type { SocialPhoto } from "@/api/publish";
import { BookNameRow } from "@/components/photo-book/book-name-row";
import { useBookNames } from "@/components/photo-book/book-names";
import type { PhotoBook } from "@/lib/photo-book";
import { cameraNameNote, withCameraName } from "@/lib/photo-book-cameras";
import { EmptyNote } from "@portfolio/components/empty-note";

/**
 * **Camera names** on a book's Info tab: each camera of the photos on its pages, with what the
 * book's captions call it instead, such as "X-T5" for "Fujifilm X-T5", and how they write it then.
 * Only the book's captions change, not the photos' data.
 */
export function CameraNamesField(props: {
  book: PhotoBook;
  photos: SocialPhoto[];
  onChange: (book: PhotoBook) => void;
}) {
  const { book, onChange } = props;
  const cameras = useBookNames(book, props.photos, "camera");
  const set = (camera: string, name: string) =>
    onChange({ ...book, cameraNames: withCameraName(book.cameraNames, camera, name) });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Camera names</legend>
      <p className="text-muted-foreground text-xs">
        Type what this book&apos;s captions call a camera instead, such as &quot;X-T5&quot;. Leave
        it empty to write the camera as it is. Only the captions change, not the photos&apos; data.
      </p>
      {cameras.length === 0 ? (
        <EmptyNote>No photo on the book&apos;s pages has a camera yet.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {cameras.map(({ name: camera, count: n }) => (
            <BookNameRow
              key={camera}
              name={camera}
              photos={n}
              value={book.cameraNames?.find((c) => c.camera === camera)?.name ?? ""}
              placeholder={camera}
              label={`What captions call ${camera}`}
              note={cameraNameNote(camera, book.cameraNames)}
              onChange={(name) => set(camera, name)}
            />
          ))}
        </ul>
      )}
    </fieldset>
  );
}
