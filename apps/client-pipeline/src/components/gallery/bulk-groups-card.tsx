import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { type PublishedFile, publishedPhotosQuery } from "@/api/photos";
import { NO_GROUPS, type PhotoGroups, addPhotoGroupsMutation, savedGroups } from "@/api/organize";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { PhotoGroupFields, Warning } from "@/components/group-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { fileData, selectProblem } from "@/components/gallery/published-file";

interface BulkGroupsCardProps {
  files: PublishedFile[];
  /** The photos the filter shows, which "Select all" chooses. */
  shown: PublishedFile[];
  selection: ReadonlySet<string>;
  onSelectionChange: (selection: ReadonlySet<string>) => void;
}

/**
 * Adds albums and tags to every chosen photo, as one commit in the photo data pull request. Each
 * photo keeps the ones it has.
 */
export function BulkGroupsCard({
  files,
  shown,
  selection,
  onSelectionChange,
}: BulkGroupsCardProps) {
  const [groups, setGroups] = useState<PhotoGroups>(NO_GROUPS);
  const { add, rebuild } = useBulkAdd(() => {
    onSelectionChange(new Set());
    setGroups(NO_GROUPS);
  });
  const chosen = files.filter((file) => selection.has(file.path));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add albums and tags</CardTitle>
        <CardDescription>
          Choose photos below, then the albums and tags to add to them. Each photo keeps the ones it
          has, and the change goes into the photo data pull request as one commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <SelectionBar
          chosen={chosen.length}
          shown={shown}
          selection={selection}
          onSelectionChange={onSelectionChange}
        />
        <PhotoGroupFields
          idPrefix="bulk"
          value={groups}
          disabled={add.isPending}
          onChange={(next) => {
            add.reset();
            setGroups(next);
          }}
          albumWarning={alreadyInAlbum(chosen, groups.albums)}
        />
        <Button
          className="self-start"
          disabled={!canAdd(add.isPending, chosen.length, groups)}
          onClick={() => add.mutate({ paths: chosen.map((file) => file.path), ...groups })}
        >
          {add.isPending && <Spinner />}
          Add to {photoCount(chosen.length)}
        </Button>
        <BulkOutcome add={add} rebuild={rebuild} />
      </CardContent>
    </Card>
  );
}

function photoCount(n: number): string {
  return n === 1 ? "1 photo" : `${n} photos`;
}

function canAdd(pending: boolean, chosen: number, groups: PhotoGroups): boolean {
  return !pending && chosen > 0 && groups.albums.length + groups.tags.length > 0;
}

/** Adds albums and tags to photos, then reads the Gallery again and follows CI's rebuild. */
function useBulkAdd(onAdded: () => void) {
  const queryClient = useQueryClient();
  const rebuild = useAllPhotosRebuild(true, () => {});
  const add = useMutation({
    ...addPhotoGroupsMutation,
    onSuccess: () => {
      rebuild.afterPush();
      onAdded();
      void queryClient.invalidateQueries({ queryKey: publishedPhotosQuery.queryKey });
    },
  });
  return { add, rebuild };
}

type BulkAdd = ReturnType<typeof useBulkAdd>;

interface SelectionBarProps {
  chosen: number;
  shown: PublishedFile[];
  selection: ReadonlySet<string>;
  onSelectionChange: (selection: ReadonlySet<string>) => void;
}

/** How many photos are chosen, with buttons to choose every one shown or none. */
function SelectionBar({ chosen, shown, selection, onSelectionChange }: SelectionBarProps) {
  const selectable = shown.filter((file) => !selectProblem(file));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium" aria-live="polite">
        {photoCount(chosen)} chosen
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={selectable.length === 0}
        onClick={() => onSelectionChange(new Set([...selection, ...selectable.map((f) => f.path)]))}
      >
        Select all shown
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={selection.size === 0}
        onClick={() => onSelectionChange(new Set())}
      >
        Clear
      </Button>
    </div>
  );
}

/** A warning when adding albums would put chosen photos already in another one in more than one. */
function alreadyInAlbum(chosen: PublishedFile[], adding: string[]): ReactNode {
  const count = chosen.filter((file) => hasOtherAlbum(file, adding)).length;
  if (adding.length === 0 || count === 0) return undefined;
  return <AlreadyInAlbum count={count} />;
}

function hasOtherAlbum(file: PublishedFile, adding: string[]): boolean {
  return savedGroups(fileData(file)).albums.some((id) => !adding.includes(id));
}

function AlreadyInAlbum({ count }: { count: number }) {
  return (
    <Warning>
      {photoCount(count)} you chose {count === 1 ? "is" : "are"} already in an album, so this puts{" "}
      {count === 1 ? "it" : "them"} in more than one.
    </Warning>
  );
}

/** What adding the albums and tags did, or why it failed. */
function BulkOutcome({ add, rebuild }: BulkAdd) {
  if (add.isError) return <p className="text-destructive">{add.error.message}</p>;
  if (!add.isSuccess) return null;
  const result = add.data;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          Added them to {photoCount(result.files)} in the app.{" "}
          <WaitingForCommit pullRequestUrl={result.pullRequestUrl} what="The changes" />
        </span>
      </p>
      <AllPhotosRebuild status={rebuild.status} />
    </div>
  );
}
