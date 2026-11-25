import { albumTree } from "@/api/organize";
import type { BookAlbum } from "@/lib/photo-book-album";

interface AlbumSelectProps {
  albums: BookAlbum[];
  /** The album picked, by ID; "" or undefined for none. */
  value: string | undefined;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Picks the album a photo book's photos come from, each sub-album indented under its album. One
 * the book names that isn't there any more is listed as missing, so the pick isn't lost unseen.
 */
export function AlbumSelect({ albums, value = "", onChange, className }: AlbumSelectProps) {
  const rows = albumTree(
    albums.map((a) => ({ id: a.id, name: a.name, parent: a.parent ?? undefined })),
  );
  const missing = value !== "" && !albums.some((a) => a.id === value);
  return (
    <select
      aria-label="Album"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <option value="">Pick an album…</option>
      {missing && <option value={value}>{value} (not found)</option>}
      {rows.map(({ group, depth }) => (
        <option key={group.id} value={group.id}>
          {`${"  ".repeat(depth)}${group.name || group.id}`}
        </option>
      ))}
    </select>
  );
}
