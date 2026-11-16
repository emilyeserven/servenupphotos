import { type ReactNode, useId } from "react";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { count } from "@/components/update-data-shared";
import type { AutogroupPhoto } from "@/lib/compare-autogroup";
import {
  type AutogroupMerge,
  type AutogroupRemoval,
  type AutogroupSuggestion,
  movingPhotos,
} from "@/lib/compare-autogroup-answer";
import { comparePhotoName } from "@/lib/compare-groups";

/** Whether a change is kept, whether it can still be changed, and what changes it. */
interface Choice {
  chosen: boolean;
  disabled: boolean;
  onChange: (chosen: boolean) => void;
}

interface ChangeRowProps extends Choice {
  /** The change's name, next to its box, such as the group's name. */
  title: ReactNode;
  /** What it does, after the name, such as "3 photos". */
  detail: ReactNode;
  photos: AutogroupPhoto[];
  /** Notes under the photos, such as why a group is removed. */
  children?: ReactNode;
}

/** One suggested change: a box to keep it, its name and what it does, its photos and any notes. */
function ChangeRow({ title, detail, photos, children, ...choice }: ChangeRowProps) {
  const id = useId();
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className="accent-primary size-4"
          checked={choice.chosen}
          disabled={choice.disabled}
          onChange={(event) => choice.onChange(event.target.checked)}
        />
        <label htmlFor={id} className="font-medium">
          {title}
        </label>
        <span className="text-muted-foreground">{detail}</span>
      </div>
      <PhotoStrip photos={photos} faded={!choice.chosen} />
      {children}
    </li>
  );
}

/** The photos as small tiles, each with its name, faded while the change is left out. */
function PhotoStrip({ photos, faded }: { photos: AutogroupPhoto[]; faded: boolean }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
      {photos.map((entry) => (
        <li key={entry.key} className="flex min-w-0 flex-col gap-1 text-xs">
          <PickedThumbnail
            data={entry.photo.data}
            alt={comparePhotoName(entry.photo)}
            className={faded ? "w-full opacity-40" : "w-full"}
          />
          <span className="truncate" title={comparePhotoName(entry.photo)}>
            {comparePhotoName(entry.photo)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A group to make, or photos to add to a group there is, with any photo it moves out of another group. */
export function SuggestionRow({ group, ...choice }: Choice & { group: AutogroupSuggestion }) {
  const detail = group.existing
    ? `add ${count(group.photos.length, "photo")} to the group there is`
    : `new group of ${count(group.photos.length, "photo")}`;
  return (
    <ChangeRow title={group.name} detail={detail} photos={group.photos} {...choice}>
      {movingPhotos(group).map((photo) => (
        <p key={photo.name} className="text-muted-foreground text-xs">
          Moves {photo.name} out of “{photo.from}”.
        </p>
      ))}
    </ChangeRow>
  );
}

/** Groups to combine into one, with the combined group's name and every photo it ends up with. */
export function MergeRow({ merge, ...choice }: Choice & { merge: AutogroupMerge }) {
  const photos = merge.groups.flatMap((group) => group.photos);
  const names = merge.groups.map((group) => `“${group.name}”`).join(" + ");
  return (
    <ChangeRow
      title={`Combine into “${merge.name}”`}
      detail={`${names}, ${count(photos.length, "photo")}`}
      photos={photos}
      {...choice}
    />
  );
}

/** A group to remove, with why, and the photos that leave it. */
export function RemovalRow({ removal, ...choice }: Choice & { removal: AutogroupRemoval }) {
  return (
    <ChangeRow
      title={`Remove “${removal.group.name}”`}
      detail={`its ${count(removal.group.photos.length, "photo")} leave the group`}
      photos={removal.group.photos}
      {...choice}
    >
      {removal.reason && <p className="text-muted-foreground text-xs">{removal.reason}</p>}
    </ChangeRow>
  );
}
