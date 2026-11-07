import type { StoryPhoto, TripStory } from "@/api/trip-stories";
import { storyId } from "@/api/trip-stories";
import type { LoosePhoto, TripDay } from "@/lib/trip-days";

/** Where a photo's text goes on the Trip page. */
export type TextSide = "caption" | "left" | "right";

/** The most photos side by side in one row of a Trip page, as in an album's layout. */
export const MAX_ROW = 4;

/** One of the day's photos in the story editor, with its words and whether the page shows it. */
export interface StoryItem {
  photo: LoosePhoto;
  /** Its own text (Markdown). */
  text: string;
  /** Shows its Comment from the Photo page in place of text. */
  useComment: boolean;
  /** Where its text goes: under it, or beside it on the left or right. */
  textSide: TextSide;
  /** Puts the next photo shown in the same row. */
  withNext: boolean;
  /** The paragraph after it, which ends its row. */
  after: string;
  /** Whether the Trip page shows it. */
  shown: boolean;
}

/** What the story editor holds: the paragraph before the first photo, and each of the day's photos. */
export interface StoryDraft {
  intro: string;
  items: StoryItem[];
}

/** Every photo of the day, with an exact spot or not, in the order they were taken. */
function storyPhotos(day: TripDay): LoosePhoto[] {
  return [...day.photos, ...day.loose].toSorted(
    (a, b) => a.taken.localeCompare(b.taken) || a.id - b.id,
  );
}

/** The item for photo from its saved entry; a photo the saved story doesn't list is left out. */
function itemOf(photo: LoosePhoto, saved: StoryPhoto | undefined, listed: boolean): StoryItem {
  const words = {
    text: "",
    useComment: false,
    textSide: "caption" as TextSide,
    withNext: false,
    after: "",
  };
  return { photo, ...words, ...saved, shown: !listed || saved !== undefined };
}

/** A day's story before any is saved. */
const NO_STORY: Pick<TripStory, "intro" | "photos"> = { intro: "", photos: [] };

/** The editor's draft of the day's saved story; with none saved, every photo shown with no words. */
export function storyDraft(day: TripDay, story: TripStory | undefined): StoryDraft {
  const { intro = "", photos } = story ?? NO_STORY;
  const saved = new Map(photos.map((p) => [p.id, p]));
  return {
    intro,
    items: storyPhotos(day).map((photo) => itemOf(photo, saved.get(photo.id), story !== undefined)),
  };
}

/** Whether the photo after item joins its row: it's linked and no paragraph comes between. */
function joinsNext(item: StoryItem): boolean {
  return item.withNext && item.after.trim() === "";
}

/** Whether a row has room for another photo. */
function hasRoom(row: StoryItem[] | undefined): row is StoryItem[] {
  return row !== undefined && row.length < MAX_ROW;
}

/** The photos the page shows, as rows of photos side by side, each row in the order taken. */
export function storyRows(items: StoryItem[]): StoryItem[][] {
  const rows: StoryItem[][] = [];
  let open = false;
  for (const item of items.filter((i) => i.shown)) {
    const last = rows.at(-1);
    if (open && hasRoom(last)) last.push(item);
    else rows.push([item]);
    open = joinsNext(item);
  }
  return rows;
}

/** Whether the next photo can join the row: it has room and no paragraph ends it. */
export function canJoin(row: StoryItem[]): boolean {
  return row.length < MAX_ROW && row.at(-1)?.after.trim() === "";
}

/** The draft with the item for photo id changed by change. */
export function withItem(
  draft: StoryDraft,
  id: number,
  change: Partial<Omit<StoryItem, "photo">>,
): StoryDraft {
  return {
    ...draft,
    items: draft.items.map((item) => (item.photo.id === id ? { ...item, ...change } : item)),
  };
}

/** Only the fields that say something: no empty text and nothing false or unset. */
function present(fields: Omit<StoryPhoto, "id">): Omit<StoryPhoto, "id"> {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) => value !== "" && value !== false && value !== undefined,
    ),
  );
}

/** The item as the story file writes it, leaving out empty words; the last of a row ends it. */
function storyPhoto(item: StoryItem, endsRow: boolean): StoryPhoto {
  return {
    id: item.photo.id,
    ...present({
      text: item.useComment ? "" : item.text.trim(),
      useComment: item.useComment,
      textSide: item.textSide === "caption" ? undefined : item.textSide,
      withNext: !endsRow,
      after: item.after.trim(),
    }),
  };
}

/** The draft as the day's story file. */
export function storyOf(day: string, draft: StoryDraft): TripStory {
  const intro = draft.intro.trim();
  const photos = storyRows(draft.items).flatMap((row) =>
    row.map((item, i) => storyPhoto(item, i === row.length - 1)),
  );
  return { id: storyId(day), date: day, ...(intro && { intro }), photos };
}
