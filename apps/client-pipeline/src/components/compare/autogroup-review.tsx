import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { MergeRow, RemovalRow, SuggestionRow } from "@/components/compare/autogroup-changes";
import { Button } from "@/components/ui/button";
import { useCompareEdits } from "@/hooks/use-compare-groups";
import { type AutogroupAnswer, changeCount } from "@/lib/compare-autogroup-answer";
import { count } from "@portfolio/lib/words";

/** The key a change is left out by: its kind and name, or its place for a combination. */
const keys = {
  group: (name: string) => `group:${name}`,
  merge: (index: number) => `merge:${index}`,
  remove: (name: string) => `remove:${name}`,
};

/** The answer with only the changes not left out. */
function keptChanges(answer: AutogroupAnswer, skipped: ReadonlySet<string>): AutogroupAnswer {
  return {
    ...answer,
    groups: answer.groups.filter((group) => !skipped.has(keys.group(group.name))),
    merges: answer.merges.filter((_, index) => !skipped.has(keys.merge(index))),
    removals: answer.removals.filter((removal) => !skipped.has(keys.remove(removal.group.name))),
  };
}

/**
 * Makes the changes kept, as local edits waiting for Commit: removed groups first, then combined
 * ones (keeping their winners), then the groups made or added to, so a photo the answer moves
 * out of a removed group still ends up where it said.
 */
function useApplyChanges() {
  const { setGroup, joinGroup } = useCompareEdits();
  return (kept: AutogroupAnswer) => {
    for (const { group } of kept.removals) {
      setGroup(
        group.photos.map((entry) => entry.photo.file),
        null,
      );
    }
    for (const merge of kept.merges) {
      const photos = merge.groups.flatMap((group) => group.photos);
      joinGroup(
        photos.map((entry) => entry.photo.file),
        merge.name,
      );
    }
    for (const group of kept.groups) {
      setGroup(
        group.photos.map((entry) => entry.photo.file),
        group.name,
      );
    }
  };
}

/**
 * The review of the LLM's answer: each group to make or add to, each combination and each removal,
 * with a box to leave it out, then a button that makes the rest, waiting for Commit.
 */
export function AutogroupReview({ answer }: { answer: AutogroupAnswer }) {
  const apply = useApplyChanges();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [done, setDone] = useState<number | null>(null);
  const kept = keptChanges(answer, skipped);
  const choice = (key: string) => ({
    chosen: !skipped.has(key),
    disabled: done !== null,
    onChange: (keep: boolean) => {
      const next = new Set(skipped);
      if (keep) next.delete(key);
      else next.add(key);
      setSkipped(next);
    },
  });
  if (changeCount(answer) === 0) {
    return (
      <div className="flex flex-col gap-4 border-t pt-6 text-sm">
        <UnknownNames answer={answer} />
        <p className="text-muted-foreground">The answer suggests no changes.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownNames answer={answer} />
      <ul className="flex flex-col gap-4">
        {answer.removals.map((removal) => (
          <RemovalRow
            key={removal.group.name}
            removal={removal}
            {...choice(keys.remove(removal.group.name))}
          />
        ))}
        {answer.merges.map((merge, index) => (
          <MergeRow key={merge.name} merge={merge} {...choice(keys.merge(index))} />
        ))}
        {answer.groups.map((group) => (
          <SuggestionRow key={group.name} group={group} {...choice(keys.group(group.name))} />
        ))}
      </ul>
      {done === null ? (
        <Button
          type="button"
          className="self-start"
          disabled={changeCount(kept) === 0}
          onClick={() => {
            apply(kept);
            setDone(changeCount(kept));
          }}
        >
          Make {count(changeCount(kept), "change")} to compare groups
        </Button>
      ) : (
        <DoneLine changes={done} />
      )}
    </div>
  );
}

/** The photo and group names in the answer that aren't any photo's or group's, so they were skipped. */
function UnknownNames({ answer }: { answer: AutogroupAnswer }) {
  const lines = [
    answer.unknown.length > 0 && `names that aren't photos: ${answer.unknown.join(", ")}`,
    answer.unknownGroups.length > 0 &&
      `names that aren't compare groups: ${answer.unknownGroups.join(", ")}`,
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-amber-700 dark:text-amber-400">
      {lines.map((line) => (
        <p key={String(line)}>Skipped {line}</p>
      ))}
    </div>
  );
}

/** What was changed, linked to the Compare page. */
function DoneLine({ changes }: { changes: number }) {
  return (
    <p>
      Made {count(changes, "change")} to compare groups, waiting for Commit.{" "}
      <Link to="/compare" className="underline underline-offset-4">
        Open Compare
      </Link>
    </p>
  );
}
