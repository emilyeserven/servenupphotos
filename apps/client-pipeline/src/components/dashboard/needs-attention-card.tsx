import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CircleCheckIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import type { SocialCalendar } from "@/api/publish";
import {
  type AttentionRow,
  NeedsAttentionTable,
} from "@/components/dashboard/needs-attention-table";
import { PhotoFiles } from "@/components/photo-files";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSocialQueue } from "@/hooks/use-social-queue";
import {
  INSTAGRAM_DAYS_WANTED,
  INSTAGRAM_URGENCY,
  type PhotoProblem,
  type ProblemCount,
  URGENCY,
  instagramShortBy,
  photoProblems,
} from "@/lib/needs-attention";
import { useChangedPhotoFiles } from "@/stores/combined-data";

/** What each photo problem says, and the page that fixes it. */
const PROBLEMS: Record<PhotoProblem, { label: string; fix: (first: string) => ReactNode }> = {
  noGps: {
    label: "Photos without GPS",
    fix: (first) => (
      <FixLink>
        <Link to="/exif" search={{ edit: first }}>
          Next photo without GPS
        </Link>
      </FixLink>
    ),
  },
  untagged: {
    label: "Photos without tags",
    fix: () => (
      <FixLink>
        <Link to="/tag-data/$section" params={{ section: "bulk-tagging" }}>
          Bulk tagging
        </Link>
      </FixLink>
    ),
  },
  noGenres: {
    label: "Photos without a genre",
    fix: () => (
      <FixLink>
        <Link to="/genre-suggestions">Genre Suggestions</Link>
      </FixLink>
    ),
  },
  noAlbums: {
    label: "Photos that aren't in an album",
    fix: () => (
      <FixLink>
        <Link to="/album-suggestions">Album Suggestions</Link>
      </FixLink>
    ),
  },
  noPlaces: {
    label: "Photos without a place",
    fix: () => (
      <FixLink>
        <Link to="/bulk-places">Bulk Places</Link>
      </FixLink>
    ),
  },
  noColors: {
    label: "Photos without color data",
    fix: () => (
      <FixLink>
        <Link to="/update-data/$section" params={{ section: "colors" }}>
          Update Data › Colors
        </Link>
      </FixLink>
    ),
  },
};

/**
 * What needs fixing across the photo files, each problem with how many photos have it and a link to
 * the page that fixes it, and an Instagram queue shorter than a week, in a table sorted most urgent
 * first.
 */
export function NeedsAttentionCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>From the photo files, with changes not committed yet.</CardDescription>
      </CardHeader>
      <CardContent>
        <PhotoFiles>{(calendar) => <Problems calendar={calendar} />}</PhotoFiles>
      </CardContent>
    </Card>
  );
}

function Problems({ calendar }: { calendar: SocialCalendar }) {
  const changed = useChangedPhotoFiles();
  const problems = useMemo(
    () => photoProblems(calendar.photos, changed),
    [calendar.photos, changed],
  );
  const queue = useSocialQueue(calendar, 0);
  const short = instagramShortBy(queue.daysLeft);
  if (problems.length === 0 && short === 0) return <AllClear />;
  const rows = problems.map(problemRow);
  if (short > 0) rows.push(instagramRow(queue.daysLeft, short));
  return <NeedsAttentionTable rows={rows} />;
}

function AllClear() {
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
      Nothing needs attention right now.
    </p>
  );
}

function photos(count: number): string {
  return count === 1 ? "1 photo" : `${count} photos`;
}

/** One photo problem's row: how many photos have it, and where to fix it. */
function problemRow(found: ProblemCount): AttentionRow {
  const { label, fix } = PROBLEMS[found.problem];
  return {
    id: found.problem,
    urgency: URGENCY[found.problem],
    label,
    labelText: label,
    count: found.count,
    countText: photos(found.count),
    fix: fix(found.first),
  };
}

/** The Instagram queue lasting less than a week, and how many photos would fill it. */
function instagramRow(daysLeft: number, short: number): AttentionRow {
  const days = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  const label =
    daysLeft === 0
      ? "Nothing is queued on Instagram for today"
      : `Instagram posts are queued for only ${days}`;
  return {
    id: "instagram",
    urgency: INSTAGRAM_URGENCY,
    label: (
      <span title={`The queue should last at least ${INSTAGRAM_DAYS_WANTED} days.`}>{label}</span>
    ),
    labelText: label,
    count: short,
    countText: `${photos(short)} to schedule`,
    fix: (
      <FixLink>
        <Link to="/instagram">Instagram calendar</Link>
      </FixLink>
    ),
  };
}

/** A link to the page that fixes a problem, with an arrow after it. */
function FixLink({ children }: { children: ReactNode }) {
  return (
    <span className="[&>a]:text-foreground inline-flex items-center gap-1 [&>a]:underline [&>a]:underline-offset-4 [&>a]:hover:no-underline">
      {children}
      <ArrowRightIcon className="size-3.5" aria-hidden />
    </span>
  );
}
