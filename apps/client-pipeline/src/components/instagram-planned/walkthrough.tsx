import { Link } from "@tanstack/react-router";
import { CalendarCheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { captionTemplates, defaultCaptionTemplate } from "@/api/captions";
import { PlannedCaption } from "@/components/instagram-planned/planned-caption";
import { PlannedPhotoView } from "@/components/instagram-planned/planned-photo";
import { useMarkScheduled } from "@/components/instagram-planned/use-mark-scheduled";
import { usePostedPhotoFiles } from "@/components/social-post-date-picker";
import { Button } from "@/components/ui/button";
import { isoDate } from "@/lib/calendar";
import { captionLists, captionValues, fillCaption } from "@/lib/caption-template";
import { type PlannedPhoto, plannedPhotos } from "@/lib/instagram-planned";
import { parseHashtags } from "@/lib/social-posts";
import { useCombinedData } from "@/stores/combined-data";

/** The planned post's own caption, trimmed, or "" when it has none. */
function writtenCaption(planned: PlannedPhoto): string {
  return planned.post?.draft.caption.trim() ?? "";
}

/** The planned post's hashtags, or none when the photo is only on the calendar. */
function plannedHashtags(planned: PlannedPhoto): string[] {
  return parseHashtags(planned.post?.draft.hashtags ?? "");
}

/**
 * The caption to post: the one written on the planned post, or else the default Instagram
 * template filled in from the photo, with the post's hashtags.
 */
function usePlannedCaption(planned: PlannedPhoto) {
  const { data } = useCombinedData();
  const template = defaultCaptionTemplate(captionTemplates(data), "instagram");
  const written = writtenCaption(planned);
  if (written || !template) return { caption: written, template, written: written !== "" };
  const values = captionValues(planned.file.data, captionLists(data), plannedHashtags(planned));
  return { caption: fillCaption(template.template, values), template, written: false };
}

/**
 * The photos still to put on Instagram, one at a time in the order they go up, each with its
 * caption and its original JPEG, and a button that marks it scheduled and moves to the next.
 * Narrow enough to sit next to Instagram.
 */
export function PlannedWalkthrough() {
  const files = usePostedPhotoFiles();
  const planned = useMemo(() => plannedPhotos(files), [files]);
  const [index, setIndex] = useState(0);
  const { mark, undo, last } = useMarkScheduled();
  // Marking takes the photo off the list, so the same place then holds the next one.
  const at = Math.min(index, planned.length - 1);
  const current = planned[at];
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <MarkedNote name={last} onUndo={undo} />
      {current ? (
        <>
          <PlannedNav at={at} count={planned.length} onMove={setIndex} />
          <PlannedStep key={current.file.path} planned={current} onMark={mark} />
        </>
      ) : (
        <NothingPlanned />
      )}
    </div>
  );
}

interface PlannedStepProps {
  planned: PlannedPhoto;
  onMark: (planned: PlannedPhoto, caption: string) => void;
}

/** One planned photo: the photo, its caption, and Mark as Scheduled. */
function PlannedStep({ planned, onMark }: PlannedStepProps) {
  const [today] = useState(() => isoDate(new Date()));
  const { caption, template, written } = usePlannedCaption(planned);
  return (
    <>
      <PlannedPhotoView planned={planned} today={today} />
      <PlannedCaption caption={caption} template={template} written={written} />
      <Button size="lg" className="h-10 text-sm" onClick={() => onMark(planned, caption)}>
        <CalendarCheckIcon />
        Mark as Scheduled and go to the next
      </Button>
    </>
  );
}

interface PlannedNavProps {
  /** The photo shown, counted from 0. */
  at: number;
  count: number;
  onMove: (index: number) => void;
}

/** Which planned photo this is, with buttons to the one before and after it. */
function PlannedNav({ at, count, onMove }: PlannedNavProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" disabled={at === 0} onClick={() => onMove(at - 1)}>
        <ChevronLeftIcon />
        Previous
      </Button>
      <p className="text-muted-foreground text-sm">
        Planned photo {at + 1} of {count}
      </p>
      <Button variant="outline" disabled={at === count - 1} onClick={() => onMove(at + 1)}>
        Next
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

/** Says which photo was just marked scheduled, with Undo. */
function MarkedNote({ name, onUndo }: { name: string | null; onUndo: () => void }) {
  if (!name) return null;
  return (
    <p className="bg-muted/50 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span>
        Marked <strong>{name}</strong> as Scheduled.
      </span>
      <Button variant="ghost" size="sm" onClick={onUndo}>
        Undo
      </Button>
    </p>
  );
}

function NothingPlanned() {
  return (
    <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
      Nothing is planned for Instagram. Put photos on the{" "}
      <Link to="/instagram" className="text-foreground underline underline-offset-4">
        Instagram calendar
      </Link>{" "}
      to go through them here.
    </p>
  );
}
