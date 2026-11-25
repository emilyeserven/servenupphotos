import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import type { BookSlot } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

interface SlotCaptionProps {
  slot: BookSlot;
  /** What the caption says: the one written by hand, or the template's. */
  text: string;
  onChange: (caption: string | null) => void;
  className?: string;
}

/**
 * A photo's caption, as the book prints it: its first line, the photo's title, in bold, and the
 * lines under it (place, date, camera, settings) small. Clicking it types over it; typed over, a
 * button puts the caption template's back. It's as tall as its text, at the top of its room unless
 * className moves it, such as `justify-end` to sit at the bottom. Sizes are in `cqw`, shares of
 * the page's width, so the text scales with the page.
 */
export function SlotCaption({ slot, text, onChange, className }: SlotCaptionProps) {
  const [editing, setEditing] = useState(false);
  if (slot.photo === "" && slot.caption === null) {
    return (
      <div
        className={cn("text-[1.9cqw] text-neutral-600 italic in-data-[print]:invisible", className)}
      >
        Caption
      </div>
    );
  }
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
        <CaptionText text={text} onEdit={() => setEditing(true)} />
      )}
      <FromTemplate slot={slot} onChange={onChange} />
    </div>
  );
}

/** The caption's first line, and the lines after it without the blank ones before them. */
function captionLines(text: string): { title: string; rest: string } {
  const [title = "", ...rest] = text.split("\n");
  return { title, rest: rest.join("\n").replace(/^\s*\n/, "") };
}

/** The caption as printed, a button that starts typing over it. */
function CaptionText({ text, onEdit }: { text: string; onEdit: () => void }) {
  const { title, rest } = captionLines(text);
  return (
    <button
      type="button"
      aria-label={`Edit the caption: ${title || "empty"}`}
      onClick={onEdit}
      className="cursor-text rounded-sm text-left hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
    >
      <span className="block text-[3cqw] leading-tight font-bold">{title || "Caption"}</span>
      {rest && (
        <span className="mt-[0.3cqw] block text-[1.9cqw] leading-snug whitespace-pre-line">
          {rest}
        </span>
      )}
    </button>
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
