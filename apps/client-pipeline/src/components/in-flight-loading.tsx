import { ImageIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** The pull request summary's rows, with how wide each value's placeholder is. */
const SUMMARY_ROWS: [string, string][] = [
  ["Pull request", "w-56"],
  ["Branch", "w-64"],
  ["Photo files", "w-8"],
  ["Synced", "w-24"],
  ["File checks", "w-72"],
];

/**
 * The pull request summary's rows with a placeholder for each value, shown while the pull request
 * is read from GitHub so the card is already its full height.
 */
export function PullRequestSummarySkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Reading the pull request from GitHub…</span>
      <dl aria-hidden className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {SUMMARY_ROWS.map(([label, width]) => (
          <Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex h-5 items-center">
              <Skeleton className={cn("h-3.5", width)} />
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

/**
 * The pull request card before Settings are read: its title, with placeholders for the repository,
 * the buttons and the summary.
 */
export function PullRequestCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull request</CardTitle>
        <CardDescription>Reading Settings…</CardDescription>
      </CardHeader>
      <CardContent>
        <PullRequestSummarySkeleton />
      </CardContent>
    </Card>
  );
}

/**
 * Placeholders for the filter bar, the Photos in flight heading and one photo, while they're read;
 * nothing once `shown` is false.
 */
export function PhotoFilesSkeleton({ shown = true }: { shown?: boolean }) {
  if (!shown) return null;
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Card className="py-4">
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-40" />
          ))}
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 py-1">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-14" />
      </div>
      <section className="@container flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid items-start gap-4 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </section>
    </div>
  );
}

/** Placeholders for the drafts on the base branch: a heading, its note and a row of tiles. */
export function DraftsSkeleton() {
  return (
    <section aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Looking for drafts on the base branch…</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <ul aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <Skeleton className="aspect-square rounded-xl" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A dashed box saying a section has nothing in it, with an icon and a line on what would fill it. */
export function EmptySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-muted/30 flex flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-8 text-center text-sm">
      <ImageIcon className="text-muted-foreground mb-1 size-8" aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground max-w-md">{children}</p>
    </div>
  );
}
