import { useState } from "react";
import type { OrganizeResponse } from "@/api/organize";
import type { ViewerLikes } from "@/api/viewer-likes";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import type { SavedPhoto } from "@/components/saved-photo-picker";
import { SuggestedAlbums } from "@/components/shared-likes/suggested-albums";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LikeCount } from "@/components/viewer-likes/most-liked";
import { toggled } from "@/lib/bulk-tags";
import type { SharedLike } from "@/lib/shared-likes";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

interface SharedPhotosProps {
  shared: SharedLike[];
  /** The chosen Like lists. */
  lists: ViewerLikes[];
  /** The saved photos by photo ID. */
  saved: ReadonlyMap<number, SavedPhoto>;
  organize: OrganizeResponse;
}

/**
 * The overlapping Likes as tiles, each ticked to start with, and the suggested albums for the ones
 * still ticked.
 */
export function SharedPhotos({ shared, lists, saved, organize }: SharedPhotosProps) {
  const [unticked, setUnticked] = useState<ReadonlySet<number>>(new Set());
  const found = shared.filter((like) => saved.has(like.id));
  const chosen = found.filter((like) => !unticked.has(like.id)).map((like) => like.id);
  const missing = shared.length - found.length;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Overlapping Likes</CardTitle>
          <CardDescription>
            The photos in the most lists come first. Untick any to leave them out of the albums.
            {missing > 0 &&
              ` ${count(missing, "liked ID")} don't match a saved photo, so they're left out.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {found.length === 0 ? (
            <EmptyNote>
              No photos are in enough of these lists. Untick a list or ask for fewer.
            </EmptyNote>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {found.map((like) => (
                <SharedTile
                  key={like.id}
                  like={like}
                  photo={saved.get(like.id)!}
                  lists={lists.length}
                  ticked={!unticked.has(like.id)}
                  onToggle={() => setUnticked(toggled(unticked, like.id))}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {chosen.length > 0 && (
        <SuggestedAlbums photos={chosen} lists={lists} saved={saved} organize={organize} />
      )}
    </>
  );
}

interface SharedTileProps {
  like: SharedLike;
  photo: SavedPhoto;
  lists: number;
  ticked: boolean;
  onToggle: () => void;
}

/** One overlapping Like: its thumbnail, a checkbox with its title, and who liked it. */
function SharedTile({ like, photo, lists, ticked, onToggle }: SharedTileProps) {
  const data = (photo.file.data ?? {}) as Record<string, unknown>;
  const who = like.people.length === lists ? "Everyone" : like.people.join(", ");
  return (
    <li className="flex min-w-0 flex-col gap-1 text-xs">
      <label className="flex min-w-0 flex-col gap-1">
        <PickedThumbnail
          data={data}
          alt={photo.name}
          className={ticked ? "w-full" : "w-full opacity-40"}
        />
        <span className="flex min-w-0 items-center gap-1.5">
          <input type="checkbox" checked={ticked} onChange={onToggle} />
          <span className="truncate" title={photo.name}>
            {photo.name}
          </span>
        </span>
      </label>
      <span className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground truncate" title={like.people.join(", ")}>
          {who}
        </span>
        <LikeCount count={like.people.length} />
      </span>
    </li>
  );
}
