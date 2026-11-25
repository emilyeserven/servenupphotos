import { useMemo } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { albumPhotoOrder } from "@/lib/album-photo-order";
import { currentLists, currentPhotos, photoIn } from "@/lib/group-photos";
import { albumAndInside, type BookAlbum, filesInOrder } from "@/lib/photo-book-album";
import { albumsOf } from "@/lib/smart-album-photos";

/** The albums a photo book can take its photos from, with the changes waiting for Commit. */
export function bookAlbums(data: CombinedData): BookAlbum[] {
  return albumsOf(currentLists(data));
}

/**
 * The photo files in the book's album, or an album inside it, in the album's order as the
 * portfolio shows it; none while the book has no album, or one that isn't there any more.
 */
export function useAlbumPhotos(
  data: CombinedData,
  files: SocialPhoto[],
  albumId: string | undefined,
): SocialPhoto[] {
  return useMemo(() => {
    const albums = bookAlbums(data);
    const album = albums.find((a) => a.id === albumId);
    if (!album) return [];
    const ids = albumAndInside(albums, album.id);
    const inAlbum = (currentPhotos(data)?.photos ?? []).filter((p) => photoIn(p, "albums", ids));
    return filesInOrder(files, albumPhotoOrder(inAlbum, album.photoOrder));
  }, [data, files, albumId]);
}
