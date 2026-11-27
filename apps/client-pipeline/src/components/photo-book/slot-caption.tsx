import { RotateCcwIcon } from "lucide-react";
import { useRef, useState } from "react";
import { CaptionRuns } from "@/components/caption-runs";
import { useCaptionOverflow } from "@/components/photo-book/use-caption-overflow";
import type { BookSlot } from "@/lib/photo-book";
import { firstLine, titleAndRest } from "@/lib/photo-book-caption-titles";
import { cn } from "@/lib/utils";

interface SlotCaptionProps {
  slot: BookSlot;
  /** What the caption says: the one written by hand, or the template's. */
  text: string;
  onChange: (caption: string | null) => void;
  /** Where it is, `<page ID>:<slot>`, to list it on the Book tab when it overflows; none on a page only shown. */
  place?: string;
  className?: string;
}

/**
 * A photo's caption, as the book prints it: its first line, the photo's title, in bold, and the
 * lines under it (place, date, camera, settings) small; a caption whose first line is blank has no
 * title, and all its lines are small (see titleAndRest). Clicking it types over it; typed over, a
 * button puts the caption template's back. It's as tall as its text, at the top of its room unless
 * className moves it, such as `justify-end` to sit at the bottom. Sizes are in `cqw`, shares of
 * the page's width, so the text scales with the page.
 */
export function SlotCaption({ slot, text, onChange, place, className }: SlotCaptionProps) {
  if (slot.photo === "" && slot.caption === null) return <EmptyCaption className={className} />;
  return (
    <FilledCaption
      slot={slot}
      text={text}
      onChange={onChange}
      place={place}
      className={className}
    />
  );
}

/** The word **Caption**, faint, where an empty place's caption goes; invisible in print. */
function EmptyCaption({ className }: { className?: string }) {
  return (
    <div
      className={cn("text-[1.9cqw] text-neutral-600 italic in-data-[print]:invisible", className)}
    >
      Caption
    </div>
  );
}

/** A caption with text: drawn as printed, or typed in, with its overflow mark and **From template**. */
function FilledCaption({ slot, text, onChange, place, className }: SlotCaptionProps) {
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLButtonElement>(null);
  const over = useCaptionOverflow(textRef, place, editing ? "" : text);
  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      {editing ? (
        <textarea
          aria-label="Caption"
          autoFocus
          value={text}
          placeholder="Caption"
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setEditing(false)}
          className="field-sizing-content min-h-0 w-full resize-none rounded-sm bg-white/10 text-[1.9cqw] leading-snug outline-none"
        />
      ) : (
        <CaptionText ref={textRef} text={text} over={over} onEdit={() => setEditing(true)} />
      )}
      <OverflowMark over={over && !editing} />
      <FromTemplate slot={slot} onChange={onChange} />
    </div>
  );
}

/** How the caption's text button looks. */
const TEXT_CLASS =
  "shrink-0 cursor-text rounded-sm text-left hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none";

/** The red outline around a caption that overflows, off the printed page and Preview Mode. */
const OVER_CLASS =
  "outline-1 outline-red-600 in-data-[preview]:outline-none in-data-[print]:outline-none";

interface CaptionTextProps {
  ref: React.Ref<HTMLButtonElement>;
  text: string;
  /** Whether it overflows its room, which outlines it in red off the printed page. */
  over: boolean;
  onEdit: () => void;
}

/** The caption as printed, a button that starts typing over it. */
function CaptionText({ ref, text, over, onEdit }: CaptionTextProps) {
  const { title, rest } = titleAndRest(text);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Edit the caption: ${firstLine(text) || "empty"}`}
      onClick={onEdit}
      className={cn(TEXT_CLASS, over && OVER_CLASS)}
    >
      <CaptionTitle title={title} rest={rest} />
      <CaptionRest rest={rest} titled={title !== ""} />
    </button>
  );
}

/** The caption's first line, the photo's title, in bold; "Caption" while it's empty; none when it has no title. */
function CaptionTitle({ title, rest }: { title: string; rest: string }) {
  if (!title && rest) return null;
  return (
    <span className="block text-[3cqw] leading-tight font-bold">
      {title ? <CaptionRuns text={title} /> : "Caption"}
    </span>
  );
}

/** The caption's lines under its title, or all of them when it has none, small; none when there are none. */
function CaptionRest({ rest, titled }: { rest: string; titled: boolean }) {
  if (!rest) return null;
  return (
    <span
      className={cn(
        "block text-[1.9cqw] leading-snug whitespace-pre-line",
        titled && "mt-[0.3cqw]",
      )}
    >
      <CaptionRuns text={rest} />
    </span>
  );
}

/** A mark under a caption that overflows its room; none when it fits, in Preview Mode and in print. */
function OverflowMark({ over }: { over: boolean }) {
  if (!over) return null;
  return (
    <span className="absolute top-0 right-0 rounded bg-red-600 px-1 text-[10px] font-medium text-white in-data-[preview]:hidden in-data-[print]:hidden">
      Caption overflows
    </span>
  );
}

/** **From template**, under a caption typed over, which puts the caption template's back. */
function FromTemplate({ slot, onChange }: Pick<SlotCaptionProps, "slot" | "onChange">) {
  if (slot.caption === null) return null;
  return (
    <button
      type="button"
      onClick={() => onChange(null)}
      title="Fill the caption in from the caption template again"
      className="flex items-center gap-1 self-start text-[10px] text-neutral-400 hover:text-white in-data-[preview]:hidden"
    >
      <RotateCcwIcon className="size-3" />
      From template
    </button>
  );
}
