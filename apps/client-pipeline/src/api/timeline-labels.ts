import { overrideId } from "@/api/cameras";
import { settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";
import type { CombinedPhoto } from "@/lib/group-photos";

/**
 * A timeline label file: a name for a run of days, such as "Japan" for a trip, which the
 * portfolio's Timeline shows beside the days it covers. Commit combines them into TIMELINE.json.
 */
export interface TimelineLabel {
  /** Made from the name and first day when the label is made, and kept after that. */
  id: string;
  /** What the Timeline shows, such as "Japan". */
  name: string;
  /** The first day the label covers, such as "2026-09-22". */
  start: string;
  /** The last day the label covers, included, such as "2026-10-02". */
  end: string;
}

function isLabel(value: unknown): value is TimelineLabel {
  const label = value as Partial<TimelineLabel> | null;
  return typeof label?.name === "string" && typeof label.start === "string";
}

/** The timeline labels as the next Commit will have them: TIMELINE.json with the changes since, newest first. */
export function timelineLabels(data: CombinedData | undefined): TimelineLabel[] {
  const entries = data ? (data.head ?? data.base).timeline.data : undefined;
  return (entries ?? []).filter(isLabel).toSorted((a, b) => b.start.localeCompare(a.start));
}

/** The ID a new label gets, such as `japan-2026-09-22`. */
export function labelId(name: string, start: string): string {
  return overrideId(`${name} ${start}`);
}

/**
 * The day the photo was taken, as its custom date or else its EXIF date writes it, such as
 * "2026-09-22" for "2026:09:22 18:42:05"; undefined when it has neither.
 */
function photoDay(photo: CombinedPhoto): string | undefined {
  const date = textOf(photo.customCreateDate) || textOf(photo.createDate);
  return /^(\d{4}):(\d{2}):(\d{2})/.exec(date)?.slice(1).join("-");
}

/** A field's text, trimmed, or "" when it isn't text. */
function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** How many of the photos were taken on a day from start to end, both included. */
export function photosBetween(photos: CombinedPhoto[], start: string, end: string): number {
  return photos.filter((photo) => {
    const day = photoDay(photo);
    return day !== undefined && day >= start && day <= end;
  }).length;
}

/** Another label that covers any day from start to end, which saving would clash with. */
export function overlappingLabel(
  labels: TimelineLabel[],
  next: Pick<TimelineLabel, "id" | "start" | "end">,
): TimelineLabel | undefined {
  return labels.find((l) => l.id !== next.id && l.start <= next.end && next.start <= l.end);
}

const labelMutations = settingMutations<TimelineLabel>("timeline");

/** Saves a timeline label, new or changed, as a change waiting for Commit. */
export const saveLabelMutation = labelMutations.save;

/** Removes a timeline label, as a change waiting for Commit. */
export const deleteLabelMutation = labelMutations.remove;
