import {
  type QueryKey,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { PendingSave } from "@/api/scan-changes";
import { CommitSuccess, SaveButton, invalidatePhotoReads } from "@/components/update-data-shared";

/** A bulk LLM card's save, such as Bulk Tagging's, which refreshes the photo reads and `refresh` once saved. */
export function useBulkSave<T extends PendingSave, V>(
  options: UseMutationOptions<T, Error, V>,
  refresh: QueryKey,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    onSuccess: () => {
      invalidatePhotoReads(queryClient);
      void queryClient.invalidateQueries({ queryKey: refresh });
    },
  });
}

interface BulkSaveButtonProps<T extends PendingSave, V> {
  apply: ReturnType<typeof useBulkSave<T, V>>;
  /** What's saved, with the photos it changes. */
  body: V & { photos: unknown[] };
  label: string;
  busy: boolean;
  /** What was saved, once it has been. */
  saved: (result: T) => ReactNode;
}

/** The button that saves a bulk LLM card's review, and what it saved once it has. */
export function BulkSaveButton<T extends PendingSave, V>({
  apply,
  body,
  label,
  busy,
  saved,
}: BulkSaveButtonProps<T, V>) {
  return (
    <>
      <SaveButton
        label={label}
        disabled={busy || body.photos.length === 0}
        pending={apply.isPending}
        error={apply.error}
        onClick={() => apply.mutate(body)}
      />
      {apply.data && <CommitSuccess result={apply.data}>{saved(apply.data)}</CommitSuccess>}
    </>
  );
}

/** Says which photos the answer named that weren't picked, when it named any. */
export function UnknownPhotos({ names, what }: { names: string[]; what: string }) {
  if (names.length === 0) return null;
  return (
    <p className="text-muted-foreground">
      Left out the answer&apos;s {what} for {names.map((name) => `“${name}”`).join(", ")}, which{" "}
      {names.length === 1 ? "isn’t one" : "aren’t any"} of the picked photos.
    </p>
  );
}
