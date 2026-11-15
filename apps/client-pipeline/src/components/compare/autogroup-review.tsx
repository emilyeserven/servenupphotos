import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { Button } from "@/components/ui/button";
import { count } from "@/components/update-data-shared";
import { useCompareEdits } from "@/hooks/use-compare-groups";
import {
  type AutogroupAnswer,
  type AutogroupSuggestion,
  movingPhotos,
} from "@/lib/compare-autogroup";
import { comparePhotoName } from "@/lib/compare-groups";

/**
 * The review of the LLM's answer: each suggested group with its photos and a box to leave it out,
 * then a button that puts the photos in their groups, waiting for Commit.
 */
export function AutogroupReview({ answer }: { answer: AutogroupAnswer }) {
  const { setGroup } = useCompareEdits();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [done, setDone] = useState<{ photos: number; groups: number } | null>(null);
  const chosen = answer.groups.filter((group) => !skipped.has(group.name));
  const photoCount = chosen.reduce((sum, group) => sum + group.photos.length, 0);
  const add = () => {
    for (const group of chosen) {
      setGroup(
        group.photos.map((entry) => entry.photo.file),
        group.name,
      );
    }
    setDone({ photos: photoCount, groups: chosen.length });
  };
  const toggle = (name: string, keep: boolean) => {
    const next = new Set(skipped);
    if (keep) next.delete(name);
    else next.add(name);
    setSkipped(next);
  };
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownNames names={answer.unknown} />
      {answer.groups.length === 0 ? (
        <p className="text-muted-foreground">The answer puts no photos together.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {answer.groups.map((group) => (
            <SuggestionRow
              key={group.name}
              group={group}
              chosen={!skipped.has(group.name)}
              disabled={done !== null}
              onChange={(keep) => toggle(group.name, keep)}
            />
          ))}
        </ul>
      )}
      {done ? (
        <DoneLine photos={done.photos} groups={done.groups} />
      ) : (
        answer.groups.length > 0 && (
          <Button type="button" className="self-start" disabled={photoCount === 0} onClick={add}>
            Add {count(photoCount, "photo")} to {count(chosen.length, "compare group")}
          </Button>
        )
      )}
    </div>
  );
}

/** The names in the answer that aren't photos in the prompt, so they were left out. */
function UnknownNames({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="text-amber-700 dark:text-amber-400">
      Left out {names.length === 1 ? "a name" : `${names.length} names`} that
      {names.length === 1 ? " isn't a photo" : " aren't photos"} in the prompt: {names.join(", ")}
    </p>
  );
}

interface SuggestionRowProps {
  group: AutogroupSuggestion;
  chosen: boolean;
  disabled: boolean;
  onChange: (chosen: boolean) => void;
}

/** One suggested group: a box to keep it, its name, its photos, and the ones it moves from another group. */
function SuggestionRow({ group, chosen, disabled, onChange }: SuggestionRowProps) {
  const id = useId();
  const moving = movingPhotos(group);
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className="accent-primary size-4"
          checked={chosen}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <label htmlFor={id} className="font-medium">
          {group.name}
        </label>
        <span className="text-muted-foreground">
          {count(group.photos.length, "photo")}
          {group.existing && ", joining the group there is"}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
        {group.photos.map((entry) => (
          <li key={entry.key} className="flex min-w-0 flex-col gap-1 text-xs">
            <PickedThumbnail
              data={entry.photo.data}
              alt={comparePhotoName(entry.photo)}
              className={chosen ? "w-full" : "w-full opacity-40"}
            />
            <span className="truncate" title={comparePhotoName(entry.photo)}>
              {comparePhotoName(entry.photo)}
            </span>
          </li>
        ))}
      </ul>
      {moving.map((photo) => (
        <p key={photo.name} className="text-muted-foreground text-xs">
          Moves {photo.name} out of “{photo.from}”.
        </p>
      ))}
    </li>
  );
}

/** What was added, linked to the Compare page. */
function DoneLine({ photos, groups }: { photos: number; groups: number }) {
  return (
    <p>
      Added {count(photos, "photo")} to {count(groups, "compare group")}, waiting for Commit.{" "}
      <Link to="/compare" className="underline underline-offset-4">
        Open Compare
      </Link>
    </p>
  );
}
