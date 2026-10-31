import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type InFlightFileRead, photosInFlightQuery, publishedPhotosQuery } from "@/api/photos";
import {
  COMPARE_GROUP,
  COMPARE_WINNER,
  type CompareGroup,
  type ComparePhoto,
  compareGroups,
  comparePhotos,
  losersOf,
  winnersOf,
} from "@/lib/compare-groups";
import { titleOf } from "@/lib/drafts";
import { UNDECIDED } from "@/lib/undecided";
import {
  UNSELECTED,
  type Unselected,
  type UnselectedImages,
  photoId,
  today,
} from "@/lib/unselected";
import { type FieldChange, useLocalEditsStore } from "@/stores/local-edits";

/** The error messages of the reads that failed. */
function readProblems(...errors: (Error | null)[]): string[] {
  return errors.filter((error) => error !== null).map((error) => error.message);
}

/**
 * Every photo that can be compared, from the Gallery and Photos in Flight with their local edits,
 * and the compare groups they're in. `pending` is true until both have been read once.
 */
export function useCompareGroups() {
  const published = useQuery(publishedPhotosQuery);
  const inFlight = useQuery(photosInFlightQuery);
  const edits = useLocalEditsStore((s) => s.edits);
  const photos = useMemo(
    () => comparePhotos(published.data, inFlight.data, edits),
    [published.data, inFlight.data, edits],
  );
  const groups = useMemo(() => compareGroups(photos), [photos]);
  return {
    photos,
    groups,
    pending: published.isPending || inFlight.isPending,
    problems: readProblems(published.error, inFlight.error),
  };
}

/** A change setting one field of the file to value, from its data as read. */
function change(file: InFlightFileRead, value: unknown): FieldChange {
  return { path: file.path, before: (file.data ?? {}) as Record<string, unknown>, value };
}

/** The photos in the group that aren't winners and have no title, so they can be set aside. */
export function untitledLosers(group: CompareGroup): ComparePhoto[] {
  return losersOf(group).filter((photo) => titleOf(photo.data) === undefined);
}

/** How Finish comparing leaves the photos that didn't win. */
export type LosersChoice =
  /** As they are, with the untitled ones set aside as Undecided when `setAside`. */
  | { kind: "leave"; setAside: boolean }
  /** In Unselected Photos, with why, and what's left of each in R2 by path. */
  | { kind: "unselect"; reason: string; images: Record<string, UnselectedImages> };

/** Each loser's `unselected`, saying why and who won, as finishing the group sets it. */
function unselectedChanges(
  group: CompareGroup,
  reason: string,
  images: Record<string, UnselectedImages>,
): FieldChange[] {
  const winners = winnersOf(group)
    .map(photoId)
    .filter((id) => id !== undefined);
  const date = today();
  return losersOf(group).map((photo) =>
    change(photo.file, {
      reason,
      winners,
      group: group.name,
      date,
      images: images[photo.file.path] ?? "kept",
    } satisfies Unselected),
  );
}

/** The changes that leave the group's losers as choice says, for the field they set. */
function loserChanges(group: CompareGroup, choice: LosersChoice): [string, FieldChange[]] {
  if (choice.kind === "unselect")
    return [UNSELECTED, unselectedChanges(group, choice.reason, choice.images)];
  const aside = choice.setAside ? untitledLosers(group) : [];
  return [UNDECIDED, aside.map((photo) => change(photo.file, true))];
}

/**
 * Changes to compare groups, saved as local edits until Commit like the Undecided mark. A field
 * cleared is set to `null` rather than false, so a photo taken out is as it was.
 */
export function useCompareEdits() {
  const setField = useLocalEditsStore((s) => s.setField);
  const setGroup = (files: InFlightFileRead[], name: string | null) => {
    setField(
      COMPARE_GROUP,
      files.map((file) => change(file, name)),
    );
    setField(
      COMPARE_WINNER,
      files.map((file) => change(file, null)),
    );
  };
  return {
    /** Puts the files in the group named name, or takes them out of theirs with null. */
    setGroup,
    /** Picks the photo as one of its group's winners, or unpicks it; a group can have several. */
    setWinner: (photo: ComparePhoto, winner: boolean) =>
      setField(COMPARE_WINNER, [change(photo.file, winner || null)]),
    /** Ends the group, taking every photo out of it and leaving the losers as choice says. */
    finish: (group: CompareGroup, choice: LosersChoice) => {
      const [field, changes] = loserChanges(group, choice);
      setField(field, changes);
      setGroup(
        group.photos.map((photo) => photo.file),
        null,
      );
    },
    /** Sets the photo's `unselected`, or takes it out of Unselected Photos with null. */
    setUnselected: (photo: ComparePhoto, unselected: Unselected | null) =>
      setField(UNSELECTED, [change(photo.file, unselected)]),
  };
}
