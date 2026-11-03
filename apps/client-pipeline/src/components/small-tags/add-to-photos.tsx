import { useState } from "react";
import type { TagLibraryPhotoInfo } from "@/api/tag-library";
import type { ActionProps } from "@/components/small-tags/small-tag-card";
import { PickablePhoto } from "@/components/small-tags/small-photos";
import { Input } from "@/components/ui/input";
import { SaveButton, count } from "@/components/update-data-shared";
import { type SmallTag, emptyLibrary } from "@/lib/small-tags";

/** How many photos the picker shows at once. */
const SHOWN = 30;

/** The other tags of the photos that have small, which photos that should have it likely share. */
function nearbyTags(small: SmallTag): Set<string> {
  const near = new Set(small.tagged.flatMap((photo) => photo.tags));
  near.delete(small.tag);
  if (small.parent) near.add(small.parent);
  return near;
}

/** Whether photo's file name, title, place or tags have every word of search. */
function matches(photo: TagLibraryPhotoInfo, search: string): boolean {
  const text = [photo.photo, photo.title, photo.city, photo.country, ...photo.tags, ...photo.places]
    .join(" ")
    .toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word));
}

/**
 * The photos without small that match search, those sharing the most tags with its photos first,
 * since they're the likeliest to need it too.
 */
function candidates(
  photos: TagLibraryPhotoInfo[],
  small: SmallTag,
  search: string,
): TagLibraryPhotoInfo[] {
  const near = nearbyTags(small);
  const shared = (photo: TagLibraryPhotoInfo) => photo.tags.filter((tag) => near.has(tag)).length;
  return photos
    .filter((photo) => !photo.tags.includes(small.tag) && matches(photo, search.trim()))
    .map((photo) => ({ photo, shared: shared(photo) }))
    .toSorted((a, b) => b.shared - a.shared || a.photo.photo.localeCompare(b.photo.photo))
    .map(({ photo }) => photo);
}

/** Adds the tag to the ticked photos, picked from the photos without it. */
export function AddToPhotos({ small, library, photos, pending, onSave }: ActionProps) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const found = candidates(library.photos, small, search);
  const toggle = (path: string) =>
    setPicked((old) => {
      const next = new Set(old);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const save = () =>
    onSave(
      {
        ...emptyLibrary(),
        photos: [...picked].map((path) => ({ path, add: [small.tag], remove: [] })),
      },
      `Added ${small.tag} to ${count(picked.size, "photo")}`,
    );
  return (
    <div className="flex flex-col gap-3 border-t pt-4 text-sm">
      <Input
        aria-label="Search the photos"
        placeholder="Search by file name, title, place or tag"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <p className="text-muted-foreground text-xs">
        {count(found.length, "photo")} without it
        {found.length > SHOWN && `, the ${SHOWN} sharing the most tags with its photos shown`}.
      </p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]">
        {found.slice(0, SHOWN).map((photo) => (
          <li key={photo.path}>
            <PickablePhoto
              photo={photo}
              byId={photos}
              picked={picked.has(photo.path)}
              onToggle={() => toggle(photo.path)}
            />
          </li>
        ))}
      </ul>
      <SaveButton
        label={`Add ${small.tag} to ${count(picked.size, "photo")}`}
        disabled={picked.size === 0}
        pending={pending}
        error={null}
        onClick={save}
      />
    </div>
  );
}
