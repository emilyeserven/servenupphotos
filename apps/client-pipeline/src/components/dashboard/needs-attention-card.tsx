import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CircleCheckIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import type { SocialCalendar } from "@/api/publish";
import { PhotoFiles } from "@/components/photo-files";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSocialQueue } from "@/hooks/use-social-queue";
import {
  INSTAGRAM_DAYS_WANTED,
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
 * the page that fixes it, and an Instagram queue shorter than a week, most urgent first: photos
 * without GPS or color data, then the Instagram queue, then the rest.
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
  const urgent = problems.filter((found) => URGENCY[found.problem] === "high");
  const rest = problems.filter((found) => URGENCY[found.problem] !== "high");
  return (
    <ul className="divide-y rounded-md border">
      <ProblemRows problems={urgent} />
      {short > 0 && <InstagramRow daysLeft={queue.daysLeft} short={short} />}
      <ProblemRows problems={rest} />
    </ul>
  );
}

/** The rows for these problems, in the order given, most urgent first. */
function ProblemRows({ problems }: { problems: ProblemCount[] }) {
  return problems.map((problem) => <ProblemRow key={problem.problem} found={problem} />);
}

function AllClear() {
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
      Nothing needs attention right now.
    </p>
  );
}

/** One problem, how many photos it affects, and where to fix it. */
function Row({ label, count, fix }: { label: ReactNode; count: string; fix: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      <span className="text-muted-foreground tabular-nums">{count}</span>
      {fix}
    </li>
  );
}

function photos(count: number): string {
  return count === 1 ? "1 photo" : `${count} photos`;
}

function ProblemRow({ found }: { found: ProblemCount }) {
  const { label, fix } = PROBLEMS[found.problem];
  return <Row label={label} count={photos(found.count)} fix={fix(found.first)} />;
}

/** The Instagram queue lasting less than a week, and how many photos would fill it. */
function InstagramRow({ daysLeft, short }: { daysLeft: number; short: number }) {
  const days = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  const label =
    daysLeft === 0
      ? "Nothing is queued on Instagram for today"
      : `Instagram posts are queued for only ${days}`;
  return (
    <Row
      label={
        <span title={`The queue should last at least ${INSTAGRAM_DAYS_WANTED} days.`}>{label}</span>
      }
      count={`${photos(short)} to schedule`}
      fix={
        <FixLink>
          <Link to="/instagram">Instagram calendar</Link>
        </FixLink>
      }
    />
  );
}

/** A link to the page that fixes a problem, with an arrow after it. */
function FixLink({ children }: { children: ReactNode }) {
  return (
    <span className="[&>a]:text-foreground flex items-center gap-1 [&>a]:underline [&>a]:underline-offset-4 [&>a]:hover:no-underline">
      {children}
      <ArrowRightIcon className="size-3.5" aria-hidden />
    </span>
  );
}
