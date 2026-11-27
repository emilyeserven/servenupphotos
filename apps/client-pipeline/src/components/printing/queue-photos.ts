import { albumPhotoOrder } from "@/lib/album-photo-order";
import { type CombinedPhoto, photoIn } from "@/lib/group-photos";
import { albumAndInside, type BookAlbum } from "@/lib/photo-book-album";

/**
 * The photos in the print queue album, or an album inside it, in the order the portfolio shows the
 * album; none while no album is chosen or the chosen one isn't there any more.
 */
export function queuePhotos(
  photos: CombinedPhoto[],
  albums: BookAlbum[],
  albumId: string,
): CombinedPhoto[] {
  const album = albums.find((a) => a.id === albumId);
  if (!album) return [];
  const ids = albumAndInside(albums, album.id);
  return albumPhotoOrder(
    photos.filter((p) => photoIn(p, "albums", ids)),
    album.photoOrder,
  );
}
