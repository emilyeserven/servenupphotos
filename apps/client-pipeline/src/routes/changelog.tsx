import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import { type ChangelogPage, changelogQuery } from "@/api/changelog";
import { ChangelogDayCard } from "@/components/changelog/changelog-day";
import { type ChangelogDay, changelogDays } from "@/components/changelog/days";
import { CommitError } from "@/components/commit-error";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/changelog")({
  component: ChangelogView,
});

/** What changed in the pipeline and portfolio, from the commits on the repository's base branch, by day. */
function ChangelogView() {
  const query = useInfiniteQuery(changelogQuery);

  return (
    <Page
      title="Changelog"
      description="What changed, from the pull requests merged into the repository in Settings, newest first."
    >
      {query.isPending && <p>Reading the branch's commits…</p>}
      {query.isError && <CommitError error={query.error} />}
      {query.data && (
        <ChangelogBody
          pages={query.data.pages}
          more={query.hasNextPage}
          loading={query.isFetchingNextPage}
          onMore={() => void query.fetchNextPage()}
        />
      )}
    </Page>
  );
}

interface ChangelogBodyProps {
  pages: ChangelogPage[];
  /** Whether GitHub has older commits. */
  more: boolean;
  loading: boolean;
  onMore: () => void;
}

/** The loaded changes by day, the photo data checkbox, and the button that loads older changes. */
function ChangelogBody({ pages, more, loading, onMore }: ChangelogBodyProps) {
  const [withPhotoData, setWithPhotoData] = useState(false);
  const first = pages.at(0);
  const days = changelogDays(
    pages.flatMap((page) => page.entries),
    withPhotoData,
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {first && <BranchLink page={first} />}
        <PhotoDataToggle checked={withPhotoData} onChange={setWithPhotoData} />
      </div>
      <ChangelogDays days={days} />
      {more && (
        <Button variant="outline" className="self-center" disabled={loading} onClick={onMore}>
          {loading ? "Loading…" : "Load older changes"}
        </Button>
      )}
    </>
  );
}

/** The repository and branch the changes are read from, linking to the branch's commits on GitHub. */
function BranchLink({ page }: { page: ChangelogPage }) {
  return (
    <a
      href={`https://github.com/${page.repo}/commits/${page.branch}`}
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:underline"
    >
      {page.repo} · {page.branch}
    </a>
  );
}

/** The checkbox that shows the merged photo data pull requests among the code changes. */
function PhotoDataToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className="accent-primary size-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Show photo data merges
    </label>
  );
}

/** A card for each day, or a note when no changes are left to show. */
function ChangelogDays({ days }: { days: ChangelogDay[] }) {
  if (days.length === 0) return <p className="text-muted-foreground text-sm">No changes yet.</p>;
  return days.map((day) => <ChangelogDayCard key={day.day} day={day} />);
}
