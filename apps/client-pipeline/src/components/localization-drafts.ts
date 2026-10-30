import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cacheSavedEntry, placesQuery, readEntries, saveLocalizationMutation } from "@/api/places";
import { type Fields, isChanged, savedFields } from "@/components/localization-row";
import { type LocalizationRow, localizationRows, shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

/** Every country, state, city and place to localize, read from the combined lists and the place files. */
export function useLocalizationRows() {
  const read = useQuery(placesQuery);
  const combined = useCombinedData();
  const places = readEntries(read.data && read.data.places);
  const rows = localizationRows(
    shownPhotos(combined.data),
    places,
    readEntries(read.data && read.data.localizations),
  );
  return {
    rows,
    places,
    pending: read.isPending || combined.isPending,
    error: firstError(read, combined),
  };
}

function firstError(...reads: { error: Error | null | undefined }[]): Error | undefined {
  return reads.find((read) => read.error)?.error ?? undefined;
}

/**
 * The rows' fields as typed, starting from `initial` (or else what's saved), and saving them: each
 * save queues behind the ones before it.
 */
export function useLocalizationDrafts(
  rows: LocalizationRow[],
  initial: Record<string, Fields> = {},
) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Fields>>(initial);
  const save = useMutation({
    ...saveLocalizationMutation,
    onSuccess: (result) => cacheSavedEntry(queryClient, "localizations", result),
  });
  const fieldsOf = (row: LocalizationRow) => drafts[row.id] ?? savedFields(row.saved);
  const changed = rows.filter((row) => isChanged(row, fieldsOf(row)));
  const saveRow = (row: LocalizationRow, fields: Fields) => {
    // A row already queued or saving isn't queued again, as when Save all is pressed twice.
    if (isSaving(queryClient, row.id)) return;
    save.mutate({
      id: row.id,
      type: row.type,
      name: row.name,
      otherNames: row.saved?.otherNames,
      ...fields,
    });
  };
  return {
    fieldsOf,
    changed,
    set: (row: LocalizationRow, fields: Fields) => setDrafts((d) => ({ ...d, [row.id]: fields })),
    save: saveRow,
    /** Queues a save of every changed row. */
    saveAll: () => changed.forEach((row) => saveRow(row, fieldsOf(row))),
  };
}

/** What `useLocalizationDrafts` gives: the fields as typed, and saving them. */
export type LocalizationDrafts = ReturnType<typeof useLocalizationDrafts>;

/** Whether a save of the localization `id` is queued or running. */
function isSaving(queryClient: QueryClient, id: string): boolean {
  const pending = queryClient.getMutationCache().findAll({
    mutationKey: saveLocalizationMutation.mutationKey,
    status: "pending",
  });
  return pending.some((m) => (m.state.variables as { id?: string } | undefined)?.id === id);
}
