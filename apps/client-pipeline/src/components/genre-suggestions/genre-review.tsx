import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type GenrePick,
  type GenreSuggestionsPreview,
  applyGenreSuggestionsMutation,
} from "@/api/genre-suggestions";
import { organizeQuery } from "@/api/organize";
import {
  SaveReviewed,
  UnknownPhotos,
  useReviewedSave,
} from "@/components/bulk-tagging/review-parts";
import { type GenreOption, PhotoGenreRow } from "@/components/genre-suggestions/photo-genre-row";
import { toggled } from "@/lib/bulk-tags";
import { type GenreChoices, NO_GENRE_CHOICES, genresToSave } from "@/lib/genre-suggestions";
import { count } from "@portfolio/lib/words";

interface GenreReviewProps {
  preview: GenreSuggestionsPreview;
  pick: GenrePick;
}

/**
 * The review of the LLM's answer: the new genres to make, each with its description, and each photo
 * next to a dropdown per suggested genre, which can pick another genre or none, then a button that
 * saves them.
 */
export function GenreReview({ preview, pick }: GenreReviewProps) {
  const [choices, setChoices] = useState<GenreChoices>(NO_GENRE_CHOICES);
  const apply = useReviewedSave(applyGenreSuggestionsMutation);
  const busy = apply.isPending || apply.isSuccess;
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownPhotos names={preview.unknown} noun="genres" />
      {/* Once saved, the new genres are made, so only what was saved is left to say. */}
      {!apply.isSuccess && (
        <NewGenreList preview={preview} choices={choices} onChange={setChoices} disabled={busy} />
      )}
      <PhotoGenreList
        preview={preview}
        pick={pick}
        choices={choices}
        onChange={setChoices}
        disabled={busy}
      />
      <SaveReviewed
        apply={apply}
        save={genresToSave(preview, choices)}
        noun="genres"
        busy={busy}
        done={(data) =>
          `Made ${count(data.newGenres, "new genre")} and added genres to ${count(data.photos, "photo")}`
        }
      />
    </div>
  );
}

interface ChoicesProps {
  choices: GenreChoices;
  onChange: (choices: GenreChoices) => void;
  disabled: boolean;
}

/** Each photo with its image and a dropdown per suggested genre, starting at that genre. */
function PhotoGenreList({
  preview,
  pick,
  choices,
  onChange,
  disabled,
}: ChoicesProps & GenreReviewProps) {
  const genres = useQuery(organizeQuery).data?.genres ?? [];
  const options = genreOptions(genres, preview.newGenres, choices.dropped);
  return (
    <ul className="flex flex-col gap-3">
      {preview.photos.map((plan) => (
        <PhotoGenreRow
          key={plan.path}
          plan={plan}
          photo={pick.photos.find((photo) => photo.path === plan.path)}
          options={options}
          choices={choices}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </ul>
  );
}

/** Every genre there is, then the new ones that will be made, each by name. */
function genreOptions(
  genres: { id: string; name: string }[],
  fresh: GenreSuggestionsPreview["newGenres"],
  dropped: ReadonlySet<string>,
): GenreOption[] {
  return [
    ...genres.map(({ id, name }) => ({ id, name, fresh: false })),
    ...fresh
      .filter(({ id }) => !dropped.has(id))
      .map(({ id, name }) => ({ id, name, fresh: true })),
  ];
}

/** The new genres the answer names, each of which can be left out. */
function NewGenreList({
  preview,
  choices,
  onChange,
  disabled,
}: ChoicesProps & { preview: GenreSuggestionsPreview }) {
  if (preview.newGenres.length === 0) {
    return <p className="text-muted-foreground">Every genre is one already.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p>New genres, made with the descriptions. Untick any you don&apos;t want:</p>
      <ul className="flex flex-col gap-1.5">
        {preview.newGenres.map((genre) => (
          <li key={genre.id}>
            <label className="flex items-start gap-1.5">
              <input
                type="checkbox"
                className="mt-1"
                checked={!choices.dropped.has(genre.id)}
                disabled={disabled}
                onChange={() =>
                  onChange({ ...choices, dropped: toggled(choices.dropped, genre.id) })
                }
              />
              <span>
                {genre.name} <code className="text-muted-foreground text-xs">{genre.id}</code>
                {genre.description && (
                  <span className="text-muted-foreground">: {genre.description}</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
