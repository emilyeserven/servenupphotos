import { useState } from "react";
import {
  type AlbumPick,
  type AlbumSuggestion,
  type AlbumSuggestionsPreview,
  applyAlbumSuggestionsMutation,
} from "@/api/album-suggestions";
import {
  SaveReviewed,
  UnknownPhotos,
  useReviewedSave,
} from "@/components/bulk-tagging/review-parts";
import { count } from "@/components/update-data-shared";
import { type AlbumChoices, albumSuggestionsToSave } from "@/lib/album-suggestions";
import { NO_CHOICES, photoTagKey, toggled } from "@/lib/bulk-tags";
import { promptImageUrl } from "@/lib/tag-prompt";
import { tileImageUrl } from "@/lib/offline-thumbnails";

interface AlbumSuggestionReviewProps {
  preview: AlbumSuggestionsPreview;
  pick: AlbumPick;
}

/**
 * The review of the LLM's answer: each album it names, existing or new, with the picked photos to
 * put in it, any of which can be unticked, then a button that saves the rest.
 */
export function AlbumSuggestionReview({ preview, pick }: AlbumSuggestionReviewProps) {
  const [choices, setChoices] = useState<AlbumChoices>(NO_CHOICES);
  const apply = useReviewedSave(applyAlbumSuggestionsMutation);
  const busy = apply.isPending || apply.isSuccess;
  const save = albumSuggestionsToSave(preview, choices);
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownPhotos names={preview.unknown} noun="albums" />
      <ul className="flex flex-col gap-3">
        {preview.albums.map((album) => (
          <SuggestedAlbum
            key={album.id || album.name}
            album={album}
            pick={pick}
            choices={choices}
            onChange={setChoices}
            disabled={busy}
          />
        ))}
      </ul>
      <SaveReviewed
        noun="albums"
        apply={apply}
        save={save}
        busy={busy}
        done={(result) =>
          `Made ${count(result.newAlbums, "new album")} and put ${count(result.photos, "photo")} in albums`
        }
      />
    </div>
  );
}

interface ChoicesProps {
  choices: AlbumChoices;
  onChange: (choices: AlbumChoices) => void;
  disabled: boolean;
}

interface SuggestedAlbumProps extends ChoicesProps {
  album: AlbumSuggestion;
  pick: AlbumPick;
}

/** One album the answer names, its photos, and whether it's used; or why it can't be an album. */
function SuggestedAlbum({ album, pick, choices, onChange, disabled }: SuggestedAlbumProps) {
  if (album.reason) {
    return (
      <li className="text-muted-foreground rounded-md border border-dashed p-3">
        Left out “{album.name}”: {album.reason}.
      </li>
    );
  }
  const used = !choices.dropped.has(album.id);
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <label className="flex items-start gap-1.5">
        <input
          type="checkbox"
          className="mt-1"
          checked={used}
          disabled={disabled}
          onChange={() => onChange({ ...choices, dropped: toggled(choices.dropped, album.id) })}
        />
        <AlbumName album={album} />
      </label>
      <ParentToggle
        album={album}
        choices={choices}
        onChange={onChange}
        disabled={disabled || !used}
      />
      <AlbumPhotos
        album={album}
        pick={pick}
        choices={choices}
        onChange={onChange}
        disabled={disabled || !used}
      />
    </li>
  );
}

/** The album's name, whether it's new, and a new one's description. */
function AlbumName({ album }: { album: AlbumSuggestion }) {
  return (
    <span>
      <span className="font-medium">{album.name}</span>{" "}
      <span className="text-muted-foreground text-xs">
        {album.new ? `(new: ${album.id})` : "(existing)"}
      </span>
      {album.description && (
        <span className="text-muted-foreground block">{album.description}</span>
      )}
    </span>
  );
}

/** The checkbox that puts a new album inside the album the answer suggests, when it suggests one. */
function ParentToggle({
  album,
  choices,
  onChange,
  disabled,
}: ChoicesProps & { album: AlbumSuggestion }) {
  if (!album.new || !album.parent) return null;
  return (
    <label className="text-muted-foreground ml-6 flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={!choices.noParent.has(album.id)}
        disabled={disabled}
        onChange={() => onChange({ ...choices, noParent: toggled(choices.noParent, album.id) })}
      />
      <span>
        Inside <code className="text-foreground">{album.parent}</code>
      </span>
    </label>
  );
}

/** The picked photos to put in the album, each of which can be unticked. */
function AlbumPhotos({ album, pick, choices, onChange, disabled }: SuggestedAlbumProps) {
  if (album.photos.length === 0) {
    return <p className="text-muted-foreground ml-6">No picked photos to put in it.</p>;
  }
  return (
    <ul className="ml-6 flex flex-wrap gap-3">
      {album.photos.map((path) => {
        const key = photoTagKey(path, album.id);
        return (
          <li key={path}>
            <label className="flex w-24 flex-col gap-1 text-xs">
              <PhotoThumb pick={pick} path={path} />
              <span className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={!choices.removed.has(key)}
                  disabled={disabled}
                  onChange={() => onChange({ ...choices, removed: toggled(choices.removed, key) })}
                />
                <code className="truncate" title={photoName(pick, path)}>
                  {photoName(pick, path)}
                </code>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** The picked photo's name, which the prompt calls it by, or its path when it wasn't picked. */
function photoName(pick: AlbumPick, path: string): string {
  return pick.photos.find((photo) => photo.path === path)?.name ?? path;
}

/** A small square of the picked photo at path. */
function PhotoThumb({ pick, path }: { pick: AlbumPick; path: string }) {
  const data = pick.photos.find((photo) => photo.path === path)?.data;
  const images = data?.images as Record<string, unknown> | undefined;
  return (
    <img
      src={tileImageUrl(data) ?? promptImageUrl(images, "")}
      alt={photoName(pick, path)}
      className="bg-muted aspect-square w-full rounded-md object-cover"
    />
  );
}
