import committedLabels from "@portfolio/data/timeline/TIMELINE.json";
import { localFile } from "@portfolio/lib/localize";

/** A name for a run of days, which the Timeline shows beside them. */
interface DayName {
  name: string;
  /** The first day it covers, such as "2026-09-22". */
  start: string;
  /** The last day it covers, included, such as "2026-10-02". */
  end: string;
}

/**
 * A Trip from TIMELINE.json: a name for a run of days, such as "Japan", which the Timeline shows
 * beside the days it covers, unless one of its own labels covers the day.
 */
export interface TimelineLabel extends DayName {
  id: string;
  /**
   * Names for parts of the Trip, such as "Korea" and "Japan" in a "Korea and Japan" Trip, each
   * shown in place of the Trip's name on its days; left out when there are none.
   */
  labels?: DayName[];
}

// Like ALLPHOTOS.local.json, TIMELINE.local.json is git-ignored and only there locally.
/** Every timeline label, from TIMELINE.json. */
const timelineLabels: TimelineLabel[] =
  localFile(
    import.meta.glob<TimelineLabel[]>("../data/timeline/TIMELINE.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedLabels as TimelineLabel[]);

/**
 * The names of the Trips that cover the day, or of their labels that do, written as "2026-09-22", joined with " · "; "" when
 * none does. The pipeline keeps labels from overlapping, so it's usually one name.
 */
export function labelOn(day: string, labels: TimelineLabel[] = timelineLabels): string {
  return labels
    .filter((trip) => covers(trip, day))
    .map((trip) => nameOn(trip, day))
    .join(" · ");
}

/** Whether the day is from the first day to the last. */
function covers({ start, end }: DayName, day: string): boolean {
  return start <= day && day <= end;
}

/** The name the Trip shows on the day: its label that covers the day, or else its own. */
function nameOn(trip: TimelineLabel, day: string): string {
  return trip.labels?.find((label) => covers(label, day))?.name ?? trip.name;
}

/** Every timeline label, newest first. */
export function allTimelineLabels(labels: TimelineLabel[] = timelineLabels): TimelineLabel[] {
  return labels.toSorted((a, b) => b.start.localeCompare(a.start));
}

/** The timeline label with the ID, or undefined when there's none. */
export function findTimelineLabel(
  id: string | undefined,
  labels: TimelineLabel[] = timelineLabels,
): TimelineLabel | undefined {
  return labels.find((label) => label.id === id);
}
