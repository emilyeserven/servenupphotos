import type {
  AlbumSuggestion,
  AlbumSuggestions,
  AlbumSuggestionsPreview,
} from "@/api/album-suggestions";
import { type BulkTagChoices, photoTagKey } from "@/lib/bulk-tags";

/**
 * What the review of an Album Suggestions answer leaves out, the same as Bulk Tagging's: albums not
 * to use (`dropped`), new albums not to put inside their parent (`noParent`), and photos not to put
 * in an album (`removed`, each as photoTagKey makes it from the photo's path and the album's ID).
 */
export type AlbumChoices = BulkTagChoices;

/** The albums the answer names that can be albums and are still ticked. */
function keptAlbums(preview: AlbumSuggestionsPreview, choices: AlbumChoices): AlbumSuggestion[] {
  return preview.albums.filter((album) => album.reason === "" && !choices.dropped.has(album.id));
}

/** The albums to put each photo in, by path, leaving out the photos unticked from an album. */
function photoAlbums(albums: AlbumSuggestion[], choices: AlbumChoices): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const album of albums) {
    for (const path of album.photos.filter((p) => !choices.removed.has(photoTagKey(p, album.id)))) {
      out.set(path, [...(out.get(path) ?? []), album.id]);
    }
  }
  return out;
}

/** A new album as it's saved: inside the album the answer suggests, unless that's unticked. */
function newAlbum(album: AlbumSuggestion, choices: AlbumChoices) {
  const parent = album.parent !== "" && !choices.noParent.has(album.id) ? album.parent : undefined;
  return { id: album.id, name: album.name, description: album.description, parent };
}

/**
 * What to save from a reviewed answer: the ticked new albums that still have a photo, and the
 * albums each ticked photo goes in.
 */
export function albumSuggestionsToSave(
  preview: AlbumSuggestionsPreview,
  choices: AlbumChoices,
): AlbumSuggestions {
  const albums = keptAlbums(preview, choices);
  const photos = photoAlbums(albums, choices);
  const used = new Set([...photos.values()].flat());
  return {
    newAlbums: albums
      .filter((album) => album.new && used.has(album.id))
      .map((album) => newAlbum(album, choices)),
    photos: [...photos].map(([path, ids]) => ({ path, albums: ids })),
  };
}
