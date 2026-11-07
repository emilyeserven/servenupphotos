import { Link2, Plus, Unlink2 } from "lucide-react";
import { Fragment, useState } from "react";
import { MarkdownField } from "@/components/album-layout/markdown-field";
import { StoryPhotoCard } from "@/components/trip-story/story-photo";
import { Button } from "@/components/ui/button";
import {
  canJoin,
  MAX_ROW,
  type StoryDraft,
  type StoryItem,
  storyRows,
  withItem,
} from "@/lib/trip-story";

interface StoryRowsProps {
  draft: StoryDraft;
  onChange: (draft: StoryDraft) => void;
}

/**
 * The photos the Trip page shows, row by row as the page lays them out, each row's photos side by
 * side with an unlink button between them, and between rows a button that joins the next photo to
 * the row and the paragraph between them.
 */
export function StoryRows({ draft, onChange }: StoryRowsProps) {
  const rows = storyRows(draft.items);
  const change = (id: number, c: Partial<StoryItem>) => onChange(withItem(draft, id, c));
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Every photo is left off the page.</p>;
  }
  return (
    <ol className="flex flex-col gap-2" aria-label="The Trip page's rows">
      {rows.map((row, r) => (
        <li key={row[0]?.photo.id} className="flex flex-col gap-2">
          <Row row={row} onChange={change} />
          <RowGap row={row} last={r === rows.length - 1} onChange={change} />
        </li>
      ))}
    </ol>
  );
}

type Change = (id: number, change: Partial<StoryItem>) => void;

/** One row's photos side by side, with an unlink button between each two. */
function Row({ row, onChange }: { row: StoryItem[]; onChange: Change }) {
  return (
    <div className="flex items-start gap-1 overflow-x-auto rounded-md border p-2">
      {row.map((item, i) => (
        <Fragment key={item.photo.id}>
          <UnlinkButton before={row[i - 1]} onChange={onChange} />
          <StoryPhotoCard
            item={item}
            onCaption={(caption) => onChange(item.photo.id, { caption })}
            onLeaveOut={() => onChange(item.photo.id, { shown: false, withNext: false })}
          />
        </Fragment>
      ))}
    </div>
  );
}

/** Splits the row after the photo before, when there's one. */
function UnlinkButton({ before, onChange }: { before?: StoryItem; onChange: Change }) {
  if (!before) return null;
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="mt-16 shrink-0"
      title="Put the next photo in a row of its own"
      aria-label="Split the row here"
      onClick={() => onChange(before.photo.id, { withNext: false })}
    >
      <Unlink2 aria-hidden />
    </Button>
  );
}

interface RowGapProps {
  row: StoryItem[];
  /** Whether it's the last row, which no photo comes after. */
  last: boolean;
  onChange: Change;
}

/** What comes between a row and the next photo: joining that photo to the row, or a paragraph. */
function RowGap({ row, last, onChange }: RowGapProps) {
  const end = row.at(-1);
  if (!end) return null;
  return (
    <div className="flex flex-col gap-2 pl-4">
      {!last && <JoinButton row={row} onClick={() => onChange(end.photo.id, { withNext: true })} />}
      <Paragraph
        key={end.photo.id}
        label={last ? "After the last photo" : "Paragraph between photos"}
        value={end.after}
        onChange={(after) => onChange(end.photo.id, { after })}
      />
    </div>
  );
}

/** Joins the next photo to the row, while it has room and no paragraph ends it. */
function JoinButton({ row, onClick }: { row: StoryItem[]; onClick: () => void }) {
  const room = row.length < MAX_ROW;
  return (
    <Button
      size="xs"
      variant="outline"
      className="w-fit"
      disabled={!canJoin(row)}
      title={room ? "A paragraph ends the row" : `A row holds up to ${MAX_ROW} photos`}
      onClick={onClick}
    >
      <Link2 aria-hidden />
      Same row as the next photo
    </Button>
  );
}

interface ParagraphProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** A paragraph's Markdown box, behind a button until it has text. */
function Paragraph({ label, value, onChange }: ParagraphProps) {
  const [open, setOpen] = useState(value !== "");
  if (!open) {
    return (
      <Button size="xs" variant="ghost" className="w-fit" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {label === "After the last photo" ? "Add a closing paragraph" : "Add a paragraph"}
      </Button>
    );
  }
  return <MarkdownField label={label} value={value} onChange={onChange} />;
}
