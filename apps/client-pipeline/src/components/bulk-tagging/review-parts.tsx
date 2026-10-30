import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { BulkTagPhoto, BulkTagPhotoPlan } from "@/api/bulk-tags";
import { organizeQuery } from "@/api/organize";
import type { PendingSave } from "@/api/scan-changes";
import {
  CommitSuccess,
  SaveButton,
  count,
  invalidatePhotoReads,
} from "@/components/update-data-shared";
import { photoTagKey } from "@/lib/bulk-tags";

/** A save of a reviewed answer that refreshes the photo reads and the albums, tags and genres once it's done. */
export function useReviewedSave<TData, TVariables>(
  options: UseMutationOptions<TData, Error, TVariables>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    onSuccess: () => {
      invalidatePhotoReads(queryClient);
      void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
    },
  });
}

interface SaveReviewedProps<TData extends PendingSave, TVariables extends { photos: unknown[] }> {
  apply: UseMutationResult<TData, Error, TVariables>;
  /** What's ticked, to save. */
  save: TVariables;
  /** What the photos get, such as "tags". */
  noun: string;
  busy: boolean;
  /** What was saved, once it has been. */
  done: (data: TData) => ReactNode;
}

/** The button that saves what's ticked, and what it saved once it has. */
export function SaveReviewed<TData extends PendingSave, TVariables extends { photos: unknown[] }>({
  apply,
  save,
  noun,
  busy,
  done,
}: SaveReviewedProps<TData, TVariables>) {
  return (
    <>
      <SaveButton
        label={`Save ${noun} for ${count(save.photos.length, "photo")}`}
        disabled={busy || save.photos.length === 0}
        pending={apply.isPending}
        error={apply.error}
        onClick={() => apply.mutate(save)}
      />
      {apply.data && <CommitSuccess result={apply.data}>{done(apply.data)}</CommitSuccess>}
    </>
  );
}

/** The picked photo's title, or "" when it has none. */
export function pickedTitle(photos: BulkTagPhoto[], path: string): string {
  const data = photos.find((photo) => photo.path === path)?.data;
  return typeof data?.title === "string" ? data.title : "";
}

interface UnknownPhotosProps {
  names: string[];
  /** What the answer gives each photo, such as "tags". */
  noun: string;
}

/** Says which photos the answer named that weren't picked, when it named any. */
export function UnknownPhotos({ names, noun }: UnknownPhotosProps) {
  if (names.length === 0) return null;
  return (
    <p className="text-muted-foreground">
      Left out the answer&apos;s {noun} for {names.map((name) => `“${name}”`).join(", ")}, which{" "}
      {names.length === 1 ? "isn’t one" : "aren’t any"} of the picked photos.
    </p>
  );
}

interface PlannedPhotoProps {
  plan: BulkTagPhotoPlan;
  title: string;
  /** What the photo gets, such as "tags". */
  noun: string;
  /** How to show an ID, such as a new genre by its name. */
  label: (id: string) => string;
  /** The IDs of the new ones, to mark them. */
  fresh: ReadonlySet<string>;
  /** The new ones not being made, which can't be ticked. */
  dropped: ReadonlySet<string>;
  /** The ones unticked on a photo, each as photoTagKey makes it. */
  removed: ReadonlySet<string>;
  disabled: boolean;
  /** Ticks or unticks the one with this photoTagKey. */
  onToggle: (key: string) => void;
}

/** One photo's tags (or genres) to add, each of which can be unticked, and the names left out of it. */
export function PlannedPhoto({ plan, title, noun, ...boxes }: PlannedPhotoProps) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md border p-3">
      <p>
        <code>{plan.name}</code>
        {title && <span className="text-muted-foreground"> · {title}</span>}
      </p>
      {plan.add.length === 0 && <p className="text-muted-foreground">No {noun} to add.</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {plan.add.map((id) => (
          <PlannedBox key={id} id={id} path={plan.path} {...boxes} />
        ))}
      </div>
      {plan.already.length > 0 && (
        <p className="text-muted-foreground">Already has {plan.already.join(", ")}.</p>
      )}
      {plan.skipped.map(({ name, reason }) => (
        <p key={name} className="text-muted-foreground">
          Left out “{name}”: {reason}.
        </p>
      ))}
    </li>
  );
}

type PlannedBoxProps = Omit<PlannedPhotoProps, "plan" | "title" | "noun"> & {
  id: string;
  path: string;
};

/** The checkbox for one of a photo's tags (or genres) to add. */
function PlannedBox({
  id,
  path,
  label,
  fresh,
  dropped,
  removed,
  disabled,
  onToggle,
}: PlannedBoxProps) {
  const key = photoTagKey(path, id);
  return (
    <label className="flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={!removed.has(key)}
        disabled={disabled || dropped.has(id)}
        onChange={() => onToggle(key)}
      />
      {label(id)}
      {fresh.has(id) && <span className="text-muted-foreground text-xs">(new)</span>}
    </label>
  );
}
