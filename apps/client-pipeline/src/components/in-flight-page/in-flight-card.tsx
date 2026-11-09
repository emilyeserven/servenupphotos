import { type UseQueryResult } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { type CombinedStatus, type InFlightResponse, type RemoveResult } from "@/api/photos";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { AllGroupFiles } from "@/components/in-flight-groups";
import { PhotoFilesSkeleton } from "@/components/in-flight-loading";
import { AllPhotosPanel } from "@/components/in-flight-page/all-photos-panel";
import { PhotoFiles } from "@/components/in-flight-page/photo-files";
import { PullRequestCard } from "@/components/in-flight-page/pull-request-card";
import { RemovedNotice } from "@/components/remove-in-flight-file";
import { useInFlight } from "@/hooks/use-in-flight";
import { useCombinedDataStore } from "@/stores/combined-data";

/** The In Flight page once Settings has a repository and token: the pull request card, the photo files and the optional ALLPHOTOS.json panel. */
export function InFlightCard() {
  const inFlight = useInFlight();
  const refreshCombined = useCombinedDataStore((s) => s.refresh);
  const [removed, setRemoved] = useState<RemoveResult | null>(null);
  // Paths removed on this visit, hidden at once: GitHub can list a deleted file for a while.
  const [removedPaths, setRemovedPaths] = useState<ReadonlySet<string>>(new Set());
  const rebuild = useAllPhotosRebuild(Boolean(inFlight.data?.pullRequest), () => {
    void inFlight.refetch();
  });
  const onRemoved = (result: RemoveResult) => {
    setRemoved(result);
    setRemovedPaths((paths) => new Set(paths).add(result.path));
    void inFlight.refetch();
  };
  const shown = withoutRemoved(inFlight.data, removedPaths);
  const baseBranch = baseBranchOf(shown);
  const showAllPhotos = useSearch({
    from: "/in-flight",
    select: (search) => search.allPhotos === true,
  });

  const files = (
    <div className="flex min-w-0 flex-col gap-6">
      <PullRequestCard
        inFlight={inFlight}
        shown={shown}
        showAllPhotos={showAllPhotos}
        onRefresh={() => {
          // The lists' read asks GitHub again, so the files read after it see a merge too.
          void refreshCombined().then(() => inFlight.refetch());
        }}
      />
      <RemovalNotice
        removed={removed}
        rebuild={rebuild.status}
        onDismiss={() => setRemoved(null)}
      />
      <PhotoFilesSkeleton shown={inFlight.isPending} />
      <PhotoFiles
        shown={shown}
        rebuilding={rebuild.rebuilding}
        baseBranch={baseBranch}
        onRemoved={onRemoved}
      />
      {shown && (
        <AllGroupFiles shown={shown} rebuilding={rebuild.rebuilding} baseBranch={baseBranch} />
      )}
    </div>
  );

  if (!showAllPhotos) return files;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      {files}
      <aside className="flex flex-col gap-2 lg:sticky lg:top-6">
        <AllPhotosPanel data={inFlight.data} />
      </aside>
    </div>
  );
}

/** What the last removal did, then whether ALLPHOTOS.json is synced with it. */
function RemovalNotice({
  removed,
  rebuild,
  onDismiss,
}: {
  removed: RemoveResult | null;
  rebuild: UseQueryResult<CombinedStatus>;
  onDismiss: () => void;
}) {
  if (!removed) return null;
  return (
    <RemovedNotice result={removed} onDismiss={onDismiss}>
      <AllPhotosRebuild status={rebuild} />
    </RemovedNotice>
  );
}

/** The branch the pull request merges into, when there is one. */
function baseBranchOf(data: InFlightResponse | undefined): string | undefined {
  return data?.pullRequest?.baseBranch;
}

/** data without the files removed on this visit, which GitHub may still list for a while. */
function withoutRemoved(
  data: InFlightResponse | undefined,
  removed: ReadonlySet<string>,
): InFlightResponse | undefined {
  if (!data || removed.size === 0) return data;
  const byPath = Object.fromEntries(
    Object.entries(data.images.byPath).filter(([path]) => !removed.has(path)),
  );
  return {
    ...data,
    files: data.files.filter((file) => !removed.has(file.path)),
    images: { ...data.images, byPath },
  };
}
