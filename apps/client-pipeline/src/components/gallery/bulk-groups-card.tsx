import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  GROUP_KIND_LIST,
  NO_GROUPS,
  type PhotoGroups,
  addPhotoGroupsMutation,
  savedGroups,
} from "@/api/organize";
import { type PublishedFile, publishedPhotosQuery } from "@/api/photos";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { ErrorNote } from "@/components/error-note";
import { fileData, selectProblem } from "@/components/gallery/published-file";
import { PhotoGroupFields, Warning } from "@/components/photo-groups-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { count } from "@portfolio/lib/words";

interface BulkGroupsCardProps {
  files: PublishedFile[];
  /** The photos the filter shows, which "Select all" chooses. */
  shown: PublishedFile[];
  selection: ReadonlySet<string>;
  onSelectionChange: (selection: ReadonlySet<string>) => void;
}

/**
 * Adds albums, tags and genres to every chosen photo, as changes waiting for Commit.
 * Each photo keeps the ones it has.
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
        <CardTitle>Add albums, tags and genres</CardTitle>
        <CardDescription>
          Choose photos below, then the albums, tags and genres to add to them. Each photo keeps the
          ones it has, and the change waits for Commit.
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
          Add to {count(chosen.length, "photo")}
        </Button>
        <BulkOutcome add={add} rebuild={rebuild} />
      </CardContent>
    </Card>
  );
}

function canAdd(pending: boolean, chosen: number, groups: PhotoGroups): boolean {
  return !pending && chosen > 0 && GROUP_KIND_LIST.some((kind) => groups[kind].length > 0);
}

/** Adds albums, tags and genres to photos, then reads the Gallery again and follows CI's rebuild. */
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
        {count(chosen, "photo")} chosen
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
  return <AlreadyInAlbum photos={count} />;
}

function hasOtherAlbum(file: PublishedFile, adding: string[]): boolean {
  return savedGroups(fileData(file)).albums.some((id) => !adding.includes(id));
}

function AlreadyInAlbum({ photos }: { photos: number }) {
  return (
    <Warning>
      {count(photos, "photo")} you chose {photos === 1 ? "is" : "are"} already in an album, so this
      puts {photos === 1 ? "it" : "them"} in more than one.
    </Warning>
  );
}

/** What adding the albums, tags and genres did, or why it failed. */
function BulkOutcome({ add, rebuild }: BulkAdd) {
  if (add.isError) return <ErrorNote error={add.error} />;
  if (!add.isSuccess) return null;
  const result = add.data;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          Added them to {count(result.files, "photo")} in the app.{" "}
          <WaitingForCommit pullRequestUrl={result.pullRequestUrl} what="The changes" />
        </span>
      </p>
      <AllPhotosRebuild status={rebuild.status} />
    </div>
  );
}
