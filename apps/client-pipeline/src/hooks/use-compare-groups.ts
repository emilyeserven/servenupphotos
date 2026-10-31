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
  isWinner,
} from "@/lib/compare-groups";
import { titleOf } from "@/lib/drafts";
import { UNDECIDED } from "@/lib/undecided";
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

/** The photos in the group that aren't its winner and have no title, so they can be set aside. */
export function untitledLosers(group: CompareGroup): ComparePhoto[] {
  return group.photos.filter((photo) => !isWinner(photo) && titleOf(photo.data) === undefined);
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
    /** Picks the photo at path as the group's winner, or unpicks every one with null. */
    pickWinner: (group: CompareGroup, path: string | null) =>
      setField(
        COMPARE_WINNER,
        group.photos.map((photo) => change(photo.file, photo.file.path === path || null)),
      ),
    /**
     * Ends the group, taking every photo out of it; with setAside, the untitled photos that didn't
     * win go in the Undecided queue.
     */
    finish: (group: CompareGroup, setAside: boolean) => {
      setGroup(
        group.photos.map((photo) => photo.file),
        null,
      );
      if (setAside)
        setField(
          UNDECIDED,
          untitledLosers(group).map((photo) => change(photo.file, true)),
        );
    },
  };
}
