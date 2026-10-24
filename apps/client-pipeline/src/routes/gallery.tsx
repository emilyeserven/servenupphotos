import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckIcon, ListChecksIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { type PublishedFile, type PublishedResponse, publishedPhotosQuery } from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { BulkGroupsCard } from "@/components/gallery/bulk-groups-card";
import { PhotoGrid } from "@/components/gallery/photo-grid";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filters";
import {
  type UndecidedChoice,
  UndecidedToggle,
  parseUndecided,
  useUndecidedFilter,
} from "@/components/gallery/undecided-filter";
import { type PhotoFilters, parseFilters } from "@/lib/photo-filters";
import {
  type Selection,
  fileName,
  photoName,
  savedString,
} from "@/components/gallery/published-file";

interface GallerySearch extends PhotoFilters {
  /** Whether Undecided photos are shown too, or only they are; hidden when left out. */
  undecided?: UndecidedChoice;
}

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): GallerySearch => ({
    ...parseFilters(search),
    undecided: parseUndecided(search),
  }),
});

function GalleryPage() {
  const settings = useQuery(settingsQuery);
  return (
    <Page
      wide
      title="Gallery"
      description="Photos already in the portfolio. Editing one saves the change to the “Add photo data” pull request, where it waits in Photos in Flight until it merges."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <PublishedPhotos />
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

function PublishedPhotos() {
  const published = useQuery(publishedPhotosQuery);
  const [filter, setFilter] = useState("");
  const selection = useSelection();
  const { shown, total, filters, undecided } = useShownFiles(published.data, filter);
  return (
    <>
      <GalleryHeader
        published={published}
        filter={filter}
        onFilterChange={setFilter}
        selecting={selection.selected !== null}
        onSelectingChange={selection.toggleSelecting}
      />
      <PhotoFilterBar
        filters={filters}
        shown={shown.length}
        total={total}
        hiding={shown.length < total}
        extraChosen={undecided !== undefined}
      >
        <UndecidedToggle choice={undecided} />
      </PhotoFilterBar>
      {selection.selected && published.data && (
        <BulkGroupsCard
          files={published.data.files}
          shown={shown}
          selection={selection.selected}
          onSelectionChange={selection.setSelected}
        />
      )}
      <QueryResult query={published} pendingLabel="Reading the portfolio's photos from GitHub…">
        {(data) => (
          <PhotoGrid
            data={data}
            shown={shown}
            filter={filter}
            selection={selection.selected}
            onToggle={selection.toggle}
          />
        )}
      </QueryResult>
    </>
  );
}

/** The photos that match the search text and the filters, newest first, out of how many there are. */
function useShownFiles(data: PublishedResponse | undefined, filter: string) {
  const { filters, filter: applyFilters } = usePhotoFilters();
  const { choice: undecided, apply: applyUndecided } = useUndecidedFilter();
  const base = { filters, undecided };
  if (!data) return { ...base, shown: [], total: 0 };
  const shown = applyUndecided(applyFilters(shownFiles(data, filter)));
  return { ...base, shown, total: data.files.length };
}

/** The photos chosen to add albums and tags to, and turning choosing them on and off. */
function useSelection() {
  const [selected, setSelected] = useState<Selection>(null);
  return {
    selected,
    setSelected,
    toggleSelecting: () => setSelected((current) => (current ? null : new Set())),
    toggle: (path: string) => setSelected((current) => current && toggled(current, path)),
  };
}

/** selection with path added, or taken out when it's there. */
function toggled(selection: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const next = new Set(selection);
  if (!next.delete(path)) next.add(path);
  return next;
}

interface GalleryHeaderProps {
  published: UseQueryResult<PublishedResponse>;
  filter: string;
  onFilterChange: (filter: string) => void;
  selecting: boolean;
  onSelectingChange: () => void;
}

function GalleryHeader({
  published,
  filter,
  onFilterChange,
  selecting,
  onSelectingChange,
}: GalleryHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio photos</CardTitle>
        <CardDescription>
          {published.data
            ? `${published.data.repo}, JSON in ${published.data.folder} on ${published.data.branch}`
            : "Reading the photo JSON on the base branch."}
        </CardDescription>
        <CardAction className="flex gap-2">
          <SelectButton on={selecting} disabled={!published.data} onClick={onSelectingChange} />
          <Button
            variant="outline"
            size="sm"
            disabled={published.isFetching}
            onClick={() => void published.refetch()}
          >
            {published.isFetching && <Spinner />}
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {published.data && <Summary data={published.data} />}
        <label className="relative block max-w-sm">
          <span className="sr-only">Filter photos</span>
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Filter by title or file name"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="pl-9"
          />
        </label>
      </CardContent>
    </Card>
  );
}

/** Turns choosing photos to add albums and tags to on, or off when it's on. */
function SelectButton({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={on ? "default" : "outline"}
      size="sm"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {on ? <CheckIcon /> : <ListChecksIcon />}
      {on ? "Done" : "Select"}
    </Button>
  );
}

/** The photos to show, newest first, that match filter. */
function shownFiles(data: PublishedResponse, filter: string): PublishedFile[] {
  return sortedNewestFirst(data.files).filter((file) => matches(file, filter));
}

/** How many photos there are, and how many of them have changes waiting in the pull request. */
function Summary({ data }: { data: PublishedResponse }) {
  const count = data.files.length;
  return (
    <p className="text-muted-foreground">
      {count === 1 ? "1 photo" : `${count} photos`}
      <InFlightCount data={data} />
      {!data.images.checked && `. ${data.images.message ?? "Couldn't check R2."}`}
    </p>
  );
}

/** How many of the photos the pull request changes, linked to it, when it changes any. */
function InFlightCount({ data }: { data: PublishedResponse }) {
  const inFlight = data.files.filter((file) => file.inFlight).length;
  if (!data.pullRequest || inFlight === 0) return null;
  return (
    <>
      ; {inFlight} with changes in{" "}
      <a
        href={data.pullRequest.url}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline underline-offset-4"
      >
        #{data.pullRequest.number}
      </a>
    </>
  );
}

/** Whether the photo's title or file names contain filter, ignoring case. */
function matches(file: PublishedFile, filter: string): boolean {
  const query = filter.trim().toLowerCase();
  if (!query) return true;
  return [photoName(file), file.photoName, fileName(file.path)].some((text) =>
    text.toLowerCase().includes(query),
  );
}

/** files by when each photo was taken, newest first, then ones without a date by path. */
function sortedNewestFirst(files: PublishedFile[]): PublishedFile[] {
  return files.toSorted((a, b) => {
    const da = savedString(a, "createDate") ?? "";
    const db = savedString(b, "createDate") ?? "";
    if (da !== db) return db.localeCompare(da);
    return a.path.localeCompare(b.path);
  });
}
