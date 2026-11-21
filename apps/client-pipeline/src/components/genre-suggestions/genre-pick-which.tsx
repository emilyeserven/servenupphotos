import { useQuery } from "@tanstack/react-query";
import type { GenrePickWhich } from "@/api/genre-suggestions";
import { organizeQuery } from "@/api/organize";
import { genreChoices } from "@/lib/genre-tree";

/** Photos without genres, which a Genre Suggestions pick starts with. */
export const NO_GENRES_PICK: GenrePickWhich = { reassign: false, genre: "" };

interface GenrePickWhichProps {
  value: GenrePickWhich;
  onChange: (value: GenrePickWhich) => void;
}

/**
 * Which photos Genre Suggestions picks: ones without genres, to add some, or ones with genres, to
 * reassign them, any genre or only one genre and its subgenres.
 */
export function GenrePickWhichChoice({ value, onChange }: GenrePickWhichProps) {
  const choices = [
    { reassign: false, label: "Photos without genres", hint: "Adds genres to them." },
    {
      reassign: true,
      label: "Photos with genres",
      hint: "Suggests their genres again, replacing the ones they have, and can move them into new subgenres.",
    },
  ];
  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1 font-medium">Photos to pick from</legend>
      {choices.map((choice) => (
        <label key={choice.label} className="flex items-start gap-2">
          <input
            type="radio"
            name="genre-pick-which"
            className="mt-1"
            checked={value.reassign === choice.reassign}
            onChange={() => onChange({ reassign: choice.reassign, genre: "" })}
          />
          <span className="flex flex-col">
            {choice.label}
            <span className="text-muted-foreground">{choice.hint}</span>
          </span>
        </label>
      ))}
      {value.reassign && (
        <GenreFilter genre={value.genre} onChange={(genre) => onChange({ ...value, genre })} />
      )}
    </fieldset>
  );
}

/** Narrows a reassign pick to the photos in one genre or its subgenres. */
function GenreFilter({ genre, onChange }: { genre: string; onChange: (genre: string) => void }) {
  const choices = genreChoices(useQuery(organizeQuery).data?.genres ?? []);
  return (
    <label className="ml-6 flex flex-wrap items-center gap-2">
      <span>In genre</span>
      <select
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        value={genre}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Any genre</option>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.label}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">
        Picking one genre, such as Architecture, is the way to have its photos sorted into
        subgenres.
      </span>
    </label>
  );
}
