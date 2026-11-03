import committedLabels from "@/data/timeline/TIMELINE.json";
import { localFile } from "@/lib/localize";

/**
 * A timeline label from TIMELINE.json: a name for a run of days, such as "Japan" for a trip, which
 * the Timeline shows beside the days it covers.
 */
export interface TimelineLabel {
  id: string;
  name: string;
  /** The first day the label covers, such as "2026-09-22". */
  start: string;
  /** The last day the label covers, included, such as "2026-10-02". */
  end: string;
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
 * The names of the labels that cover the day, written as "2026-09-22", joined with " · "; "" when
 * none does. The pipeline keeps labels from overlapping, so it's usually one name.
 */
export function labelOn(day: string, labels: TimelineLabel[] = timelineLabels): string {
  return labels
    .filter(({ start, end }) => start <= day && day <= end)
    .map(({ name }) => name)
    .join(" · ");
}
