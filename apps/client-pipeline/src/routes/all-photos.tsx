import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  type InFlightRead,
  photosInFlightQuery,
  publishedPhotosQuery,
  type PublishedResponse,
} from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { AllPhotosControls, useSetSearch } from "@/components/all-photos/all-photos-controls";
import { type AllPhotosEntry, allPhotosEntries } from "@/components/all-photos/all-photos-files";
import { AllPhotosGrid, scrollToTile } from "@/components/all-photos/all-photos-grid";
import {
  type AllPhotosSearch,
  parseAllPhotosSearch,
} from "@/components/all-photos/all-photos-search";
import { defaultOrder, sortEntries } from "@/components/all-photos/all-photos-sort";
import { JumpBox } from "@/components/all-photos/jump-box";
import { OfflineNotice } from "@/components/offline-notice";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent } from "@/components/ui/card";
import { useUntitledDrafts } from "@/lib/drafts";
import { useLocalEditsStore } from "@/stores/local-edits";

export const Route = createFileRoute("/all-photos")({
  component: AllPhotosPage,
  staticData: { wide: true },
  validateSearch: parseAllPhotosSearch,
});

function AllPhotosPage() {
  const settings = useQuery(settingsQuery);
  return (
    <Page
      wide
      title="All Photos"
      description="Every photo in the portfolio's order, with the photos in flight. Show the drafts and Undecided photos to see where each would go among the published ones."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) => (data.github.repo && data.github.token.set ? <AllPhotos /> : <NotSetUp />)}
      </QueryResult>
    </Page>
  );
}

/** Says the GitHub repository and token are needed first. */
function NotSetUp() {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground">
          Not set up: add the GitHub repository and token in{" "}
          <Link to="/settings" className="text-foreground underline underline-offset-4">
            Settings
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

/** The base branch's photos, read with the pull request's over them once both are read. */
function AllPhotos() {
  const published = useQuery(publishedPhotosQuery);
  const inFlight = useQuery(photosInFlightQuery);
  return (
    <QueryResult query={published} pendingLabel="Reading the portfolio's photos…">
      {(data) =>
        inFlight.isPending ? (
          <p>Reading the photos in flight…</p>
        ) : (
          <AllPhotosList published={data} inFlight={inFlight.data} />
        )
      }
    </QueryResult>
  );
}

/** Whether the entry is shown: published, of a kind the toggles show, or the photo `?photo=` names. */
function isShown(entry: AllPhotosEntry, search: AllPhotosSearch): boolean {
  if (entry.path === search.photo) return true;
  if (entry.kind === "draft") return search.drafts === true;
  return entry.kind === "published" || search.undecided === true;
}

function useEntries(published: PublishedResponse, inFlight: InFlightRead | undefined) {
  const edits = useLocalEditsStore((s) => s.edits);
  const keepDrafts = useUntitledDrafts();
  return useMemo(
    () => allPhotosEntries(published, inFlight, edits, keepDrafts),
    [published, inFlight, edits, keepDrafts],
  );
}

function AllPhotosList({
  published,
  inFlight,
}: {
  published: PublishedResponse;
  inFlight?: InFlightRead;
}) {
  const search = Route.useSearch();
  const setSearch = useSetSearch();
  const sort = search.sort ?? "taken";
  const order = search.order ?? defaultOrder(sort);
  const entries = useEntries(published, inFlight);
  const sorted = useMemo(() => sortEntries(entries, sort, order), [entries, sort, order]);
  // Scrolls to the photo a link from another page names, once the photos are listed.
  useEffect(() => {
    if (search.photo) scrollToTile(search.photo);
  }, [search.photo]);
  const jump = (entry: AllPhotosEntry) => {
    const kind =
      entry.kind === "undecided" ? { undecided: true as const } : { drafts: true as const };
    void setSearch({ photo: entry.path, ...kind }).then(() => scrollToTile(entry.path));
  };
  return (
    <>
      <OfflineNotice images={published.images} />
      <AllPhotosControls entries={entries} search={search} sort={sort} order={order} />
      <AllPhotosGrid
        entries={sorted.filter((entry) => isShown(entry, search))}
        highlight={search.photo}
      />
      <JumpBox
        entries={sorted.filter((entry) => entry.kind !== "published")}
        current={search.photo}
        onJump={jump}
      />
    </>
  );
}
