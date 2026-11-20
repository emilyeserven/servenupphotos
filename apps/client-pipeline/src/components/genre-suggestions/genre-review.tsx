import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type GenrePick,
  type GenreSuggestionsPreview,
  applyGenreSuggestionsMutation,
} from "@/api/genre-suggestions";
import { type Group, organizeQuery } from "@/api/organize";
import { NewGenreList } from "@/components/genre-suggestions/new-genre-list";
import { SaveReviewed, useReviewedSave } from "@/components/bulk-tagging/review-parts";
import { UnknownPhotos } from "@/components/paste-answer";
import { type GenreOption, PhotoGenreRow } from "@/components/genre-suggestions/photo-genre-row";
import { type GenreChoices, NO_GENRE_CHOICES, genresToSave } from "@/lib/genre-suggestions";
import { withOthers } from "@/lib/answered-photos";
import { count } from "@portfolio/lib/words";

interface GenreReviewProps {
  preview: GenreSuggestionsPreview;
  pick: GenrePick;
  /** True when the photos' genres are replaced by the reviewed ones, rather than added to. */
  reassign: boolean;
}

/**
 * The review of the LLM's answer: the new genres to make, each with its description, and each photo
 * next to a dropdown per suggested genre, which can pick another genre or none, then a button that
 * saves them.
 */
export function GenreReview({ preview, pick: picked, reassign }: GenreReviewProps) {
  const pick = withOthers(picked, preview.others);
  const genres = useGenres();
  const [choices, setChoices] = useState<GenreChoices>(NO_GENRE_CHOICES);
  const apply = useReviewedSave(applyGenreSuggestionsMutation);
  const busy = apply.isPending || apply.isSuccess;
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownPhotos names={preview.unknown} others={preview.others} noun="genres" />
      {/* Once saved, the new genres are made, so only what was saved is left to say. */}
      <NewGenreList
        hidden={apply.isSuccess}
        preview={preview}
        genres={genres}
        choices={choices}
        onChange={setChoices}
        disabled={busy}
      />
      <PhotoGenreList
        preview={preview}
        pick={pick}
        genres={genres}
        reassign={reassign}
        choices={choices}
        onChange={setChoices}
        disabled={busy}
      />
      <SaveReviewed
        apply={apply}
        save={genresToSave(preview, choices, reassign)}
        noun="genres"
        busy={busy}
        done={(data) => doneText(data, reassign)}
      />
    </div>
  );
}

/** Every genre there is, or none until they're read. */
function useGenres(): Group[] {
  return useQuery(organizeQuery).data?.genres ?? [];
}

/** What a save did, in words, such as "Made 1 new genre and added genres to 3 photos". */
function doneText(data: { newGenres: number; photos: number }, reassign: boolean): string {
  const did = reassign ? "changed the genres of" : "added genres to";
  return `Made ${count(data.newGenres, "new genre")} and ${did} ${count(data.photos, "photo")}`;
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
  genres,
  reassign,
  choices,
  onChange,
  disabled,
}: ChoicesProps & GenreReviewProps & { genres: Group[] }) {
  const options = genreOptions(genres, preview.newGenres, choices.dropped);
  return (
    <ul className="flex flex-col gap-3">
      {preview.photos.map((plan) => (
        <PhotoGenreRow
          key={plan.path}
          plan={plan}
          photo={pick.photos.find((photo) => photo.path === plan.path)}
          options={options}
          genres={reassign ? genres : undefined}
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
