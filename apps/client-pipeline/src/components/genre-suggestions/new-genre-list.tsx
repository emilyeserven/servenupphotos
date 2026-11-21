import type { GenreNew, GenreSuggestionsPreview } from "@/api/genre-suggestions";
import type { Group } from "@/api/organize";
import { toggled } from "@/lib/bulk-tags";
import { type GenreChoices, chosenParent, withChosenParent } from "@/lib/genre-suggestions";
import { type GenreChoice, genreChoices } from "@/lib/genre-tree";

interface NewGenreListProps {
  preview: GenreSuggestionsPreview;
  /** Every genre there is, which a new genre can go under. */
  genres: Group[];
  choices: GenreChoices;
  onChange: (choices: GenreChoices) => void;
  disabled: boolean;
  /** True once they're saved, when there's nothing left to choose. */
  hidden?: boolean;
}

/**
 * The new genres the answer names, each of which can be left out, with the genre each goes under
 * as a subgenre (as the answer put it, to change or clear).
 */
export function NewGenreList({
  preview,
  genres,
  choices,
  onChange,
  disabled,
  hidden = false,
}: NewGenreListProps) {
  if (hidden) return null;
  if (preview.newGenres.length === 0) {
    return <p className="text-muted-foreground">Every genre is one already.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p>
        New genres, made with the descriptions. Untick any you don&apos;t want, and pick the genre a
        subgenre goes under:
      </p>
      <ul className="flex flex-col gap-2">
        {preview.newGenres.map((genre) => (
          <NewGenreRow
            key={genre.id}
            genre={genre}
            preview={preview}
            genres={genres}
            choices={choices}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </ul>
    </div>
  );
}

/** One new genre: its tick box, name, description and parent. */
function NewGenreRow({
  genre,
  preview,
  genres,
  choices,
  onChange,
  disabled,
}: NewGenreListProps & { genre: GenreNew }) {
  const made = !choices.dropped.has(genre.id);
  return (
    <li className="flex flex-wrap items-start justify-between gap-2">
      <label className="flex min-w-0 flex-1 items-start gap-1.5">
        <input
          type="checkbox"
          className="mt-1"
          checked={made}
          disabled={disabled}
          onChange={() => onChange({ ...choices, dropped: toggled(choices.dropped, genre.id) })}
        />
        <span>
          {genre.name} <code className="text-muted-foreground text-xs">{genre.id}</code>
          {genre.description && (
            <span className="text-muted-foreground">: {genre.description}</span>
          )}
        </span>
      </label>
      <ParentSelect
        genre={genre}
        options={parentOptions(genres, preview.newGenres, choices, genre.id)}
        value={chosenParent(choices, genre)}
        disabled={disabled || !made}
        onChange={(parent) => onChange(withChosenParent(choices, genre.id, parent))}
      />
    </li>
  );
}

/**
 * The genres a new genre can go under: every genre there is, each subgenre after its genre, then
 * the other new genres that will be made.
 */
function parentOptions(
  genres: Group[],
  fresh: GenreNew[],
  choices: GenreChoices,
  self: string,
): GenreChoice[] {
  const others = fresh
    .filter((g) => g.id !== self && !choices.dropped.has(g.id))
    .map((g) => ({ id: g.id, label: `${g.name} (new)` }));
  return [...genreChoices(genres), ...others];
}

interface ParentSelectProps {
  genre: GenreNew;
  options: GenreChoice[];
  /** The parent's ID, or "" for top level. */
  value: string;
  disabled: boolean;
  onChange: (parent: string) => void;
}

/** A dropdown of the genre a new one goes under, with "Top level" first. */
function ParentSelect({ genre, options, value, disabled, onChange }: ParentSelectProps) {
  return (
    <select
      aria-label={`Genre ${genre.name} goes under`}
      className="border-input bg-background h-9 w-full max-w-xs rounded-md border px-3 text-sm sm:w-56"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Top level</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          Under {option.label.trimStart()}
        </option>
      ))}
    </select>
  );
}
