import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import type { CombinedData } from "@/api/photos";
import { tripLines } from "@/api/trip-lines";
import { tripStories } from "@/api/trip-stories";
import { trips } from "@/api/trips";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { DayEditor } from "@/components/trip-lines/day-editor";
import { dayTitle } from "@/components/trip-lines/day-title";
import { StoryCard } from "@/components/trip-story/story-card";
import { Button } from "@/components/ui/button";
import { lineDays } from "@/lib/stale-trip-lines";
import type { TripDay } from "@/lib/trip-days";
import { type DayPart, DAY_PARTS } from "@/lib/trip-lines-search";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/** What each of a day's pages is called in its tabs. */
const PART_LABELS: Record<DayPart, string> = {
  order: "Photo order",
  route: "Route",
  story: "Story",
};

/**
 * One day's pages on Trip Lines: the photo order, the route on the map, and the story for the
 * portfolio's Trip page, each its own link.
 */
export function TripDayPage() {
  const { day } = useParams({ from: "/trip-lines/$day/$part" });
  return (
    <Page
      wide
      title={dayTitle(day)}
      description="This day's trip line, in three steps: the photos' order and groups, the route drawn on the map, and the story the portfolio's Trip page tells."
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/trip-lines">
            <ArrowLeftIcon aria-hidden />
            Every day
          </Link>
        </Button>
      }
    >
      <GitHubGate>{() => <DayData day={day} />}</GitHubGate>
    </Page>
  );
}

/** The day once the photos and lines are read. */
function DayData({ day }: { day: string }) {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and trip lines…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <DayFound data={combined.data} day={day} />;
}

/** The day's pages, or a note when it has no trip line. */
function DayFound({ data, day }: { data: CombinedData; day: string }) {
  const found = lineDays(data).find((d) => d.day === day);
  if (!found) {
    return (
      <p className="text-muted-foreground text-sm">
        This day doesn't have two or more photos at two or more exact spots, so it has no trip line.
      </p>
    );
  }
  return <DayParts data={data} day={found} />;
}

/**
 * The tabs and the page chosen. The editor and the story stay mounted while hidden, so changes not
 * saved yet survive moving between the pages.
 */
function DayParts({ data, day }: { data: CombinedData; day: TripDay }) {
  const { part } = useParams({ from: "/trip-lines/$day/$part" });
  return (
    <>
      <PartTabs day={day.day} part={part} />
      <div hidden={part === "story"}>
        <DayEditor
          key={day.day}
          day={day}
          line={tripLines(data).get(day.day)}
          part={part === "route" ? "route" : "order"}
        />
      </div>
      <div hidden={part !== "story"}>
        <StoryCard
          key={`story-${day.day}`}
          day={day}
          story={tripStories(data).get(day.day)}
          trips={trips(data)}
        />
      </div>
    </>
  );
}

/** The day's pages as tabs, each a link, keeping the group shown alone. */
function PartTabs({ day, part }: { day: string; part: string }) {
  return (
    <nav
      aria-label="This day's pages"
      className="bg-muted text-muted-foreground inline-flex w-fit items-center rounded-lg p-1"
    >
      {DAY_PARTS.map((p) => (
        <Link
          key={p}
          to="/trip-lines/$day/$part"
          params={{ day, part: p }}
          search={(s) => s}
          aria-current={p === part ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium",
            p === part && "bg-background text-foreground shadow-sm",
          )}
        >
          {PART_LABELS[p]}
        </Link>
      ))}
    </nav>
  );
}
