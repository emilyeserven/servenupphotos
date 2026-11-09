import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { settingsQuery } from "@/api/settings";
import { type DraftSort, parseDraftSort } from "@/components/draft-sort";
import { PhotoFilesSkeleton, PullRequestCardSkeleton } from "@/components/in-flight-loading";
import { InFlightCard } from "@/components/in-flight-page/in-flight-card";
import { type InFlightSort, parseInFlightSort } from "@/components/in-flight-sort";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { DRAFT_FILTERS } from "@/components/saved-drafts";
import { Card, CardContent } from "@/components/ui/card";
import { type PhotoFilters, parseFilters, prefixedFilters } from "@/lib/photo-data-filters";

interface InFlightSearch extends PhotoFilters {
  /** Shows ALLPHOTOS.json in a panel beside the photo files. */
  allPhotos?: true;
  /** How the drafts on the base branch are sorted; their filters are kept as `draftPlace` and so on. */
  draftSort?: DraftSort;
  /** How the photos in flight are sorted; untitled first when unset. */
  sort?: InFlightSort;
  [draftFilter: string]: unknown;
}

export const Route = createFileRoute("/in-flight")({
  component: InFlightPage,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): InFlightSearch => ({
    ...(search.allPhotos === true ? { allPhotos: true } : {}),
    ...parseFilters(search),
    ...prefixedFilters(search, DRAFT_FILTERS),
    ...(parseDraftSort(search) ? { draftSort: parseDraftSort(search) } : {}),
    ...(parseInFlightSort(search) ? { sort: parseInFlightSort(search) } : {}),
  }),
});

function InFlightPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      wide
      title="Photos in Flight"
      description="Photo, album, tag, genre, place, localization, metadata group, camera override and custom lens data waiting for Commit, or in the open “Add photo data” pull request and not merged yet."
    >
      <QueryResult
        query={settings}
        pending={
          <>
            <PullRequestCardSkeleton />
            <PhotoFilesSkeleton />
          </>
        }
      >
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <InFlightCard />
          ) : (
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
          )
        }
      </QueryResult>
    </Page>
  );
}
