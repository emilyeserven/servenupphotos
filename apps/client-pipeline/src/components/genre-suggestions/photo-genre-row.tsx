import type { BulkTagPhoto, BulkTagPhotoPlan } from "@/api/bulk-tags";
import { type Group, savedGroups } from "@/api/organize";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { PlanNotes } from "@/components/bulk-tagging/review-parts";
import {
  type GenreChoices,
  chosenGenre,
  genreSlots,
  withChosenGenre,
} from "@/lib/genre-suggestions";

/** A genre a photo's dropdown can pick, by ID, with its name and whether the answer made it up. */
export interface GenreOption {
  id: string;
  name: string;
  /** True for a new genre from the answer, marked "(new)". */
  fresh: boolean;
}

interface PhotoGenreRowProps {
  plan: BulkTagPhotoPlan;
  /** The picked photo, for its image and title; undefined when it can't be found. */
  photo: BulkTagPhoto | undefined;
  /** Every genre to pick from, in order, leaving out new ones that won't be made. */
  options: GenreOption[];
  choices: GenreChoices;
  onChange: (choices: GenreChoices) => void;
  disabled: boolean;
  /**
   * Every genre there is, when the photo's genres are being reassigned, to show the ones it has
   * now; undefined when genres are only added.
   */
  genres?: Group[];
}

/**
 * One photo in the review of its genres: its image on the left, and on the right a dropdown of
 * genres for each one the answer suggested, starting at that genre, with "No genre" to leave it out.
 */
export function PhotoGenreRow({
  plan,
  photo,
  options,
  choices,
  onChange,
  disabled,
  genres,
}: PhotoGenreRowProps) {
  return (
    <li className="flex gap-3 rounded-md border p-3">
      <RowImage plan={plan} photo={photo} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <RowHeading plan={plan} photo={photo} />
        {genres && <GenresNow photo={photo} genres={genres} />}
        {genreSlots(plan).map((suggested, slot) => (
          <GenreSelect
            // The dropdowns never change order, so their place is a steady key.
            // oxlint-disable-next-line react/no-array-index-key
            key={slot}
            label={`Genre ${slot + 1} for ${plan.name}`}
            value={chosenGenre(choices, plan.path, slot, suggested)}
            options={options}
            disabled={disabled}
            onChange={(id) => onChange(withChosenGenre(choices, plan.path, slot, id))}
          />
        ))}
        <PlanNotes plan={plan} />
      </div>
    </li>
  );
}

/** The genres a photo has now, which the ones picked below replace. */
function GenresNow({ photo, genres }: { photo: BulkTagPhoto | undefined; genres: Group[] }) {
  const ids = savedGroups(photo?.data).genres;
  const names = ids.map((id) => genres.find((g) => g.id === id)?.name || id);
  return (
    <p className="text-muted-foreground">
      Now: {names.length > 0 ? names.join(", ") : "no genres"}. The genres below replace these.
    </p>
  );
}

/** The picked photo's title, or "" when it has none or can't be found. */
function photoTitle(photo: BulkTagPhoto | undefined): string {
  return typeof photo?.data.title === "string" ? photo.data.title : "";
}

interface RowPartProps {
  plan: BulkTagPhotoPlan;
  photo: BulkTagPhoto | undefined;
}

/** The photo's image, on the left of its row. */
function RowImage({ plan, photo }: RowPartProps) {
  if (!photo) return null;
  return (
    <PickedThumbnail
      data={photo.data}
      alt={photoTitle(photo) || plan.name}
      className="w-24 shrink-0 self-start sm:w-40"
    />
  );
}

/** The photo's file name and title, and a note when the answer suggested no genre for it. */
function RowHeading({ plan, photo }: RowPartProps) {
  const title = photoTitle(photo);
  return (
    <>
      <p className="truncate">
        <code>{plan.name}</code>
        {title && <span className="text-muted-foreground"> · {title}</span>}
      </p>
      {plan.add.length === 0 && (
        <p className="text-muted-foreground">The answer suggested no genre.</p>
      )}
    </>
  );
}

interface GenreSelectProps {
  /** What the dropdown is read out as, such as "Genre 1 for DSCF4800". */
  label: string;
  /** The genre ID it shows, or "" for no genre. */
  value: string;
  options: GenreOption[];
  disabled: boolean;
  onChange: (id: string) => void;
}

/** A dropdown of every genre, with "No genre" first. */
function GenreSelect({ label, value, options, disabled, onChange }: GenreSelectProps) {
  // Until the genres have loaded, the shown one is still listed, by its ID.
  const listed =
    value && !options.some((option) => option.id === value)
      ? [{ id: value, name: value, fresh: false }, ...options]
      : options;
  return (
    <select
      aria-label={label}
      className="border-input bg-background h-9 w-full max-w-xs rounded-md border px-3 text-sm"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">No genre</option>
      {listed.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
          {option.fresh ? " (new)" : ""}
        </option>
      ))}
    </select>
  );
}
