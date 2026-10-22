import { ChevronDownIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { CameraSettings, Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** Markdown's lists, links, code and quotes, which Tailwind's reset strips, kept compact for a caption. */
const PROSE =
  "break-words [&_p+*]:mt-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-4 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-current/10 [&_code]:px-1 [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-2 [&_h1,&_h2,&_h3]:font-medium";

/** Keeps each line break written in the comment, not only blank lines between paragraphs. */
const MARKDOWN_PLUGINS = [remarkBreaks];

interface PhotoNotesProps {
  photo: Photo;
  /** How many lines of the comment to show before cutting it off. */
  lines?: 1 | 2;
  /** Puts each camera setting on its own line, for narrow spaces like a Grid tile. */
  stacked?: boolean;
  className?: string;
  expandedClassName?: string;
}

/** The photo's comment, with how the camera was set to its right. */
export function PhotoNotes({ photo, stacked, className, ...comment }: PhotoNotesProps) {
  const settings = settingsText(photo.settings);
  if (!photo.comment && settings.length === 0) return null;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {photo.comment && <PhotoComment comment={photo.comment} {...comment} />}
      <SettingsText settings={settings} stacked={stacked} />
    </div>
  );
}

/** The settings as a photographer writes them: "f/5.6", "1/60s", "ISO 400". */
function settingsText({ aperture, exposure, iso }: CameraSettings): string[] {
  return [
    aperture === null ? null : `f/${aperture}`,
    exposure === null ? null : `${exposure}s`,
    iso === null ? null : `ISO ${iso}`,
  ].filter((text) => text !== null);
}

function SettingsText({ settings, stacked }: { settings: string[]; stacked?: boolean }) {
  if (settings.length === 0) return null;
  return (
    <p
      className={cn(
        "ml-auto shrink-0 text-right whitespace-nowrap tabular-nums opacity-70",
        stacked && "flex flex-col",
      )}
    >
      {stacked ? settings.map((text) => <span key={text}>{text}</span>) : settings.join(" · ")}
    </p>
  );
}

interface PhotoCommentProps {
  comment: string;
  /** How many lines to show before cutting it off: one or two. */
  lines?: 1 | 2;
  className?: string;
  /** Colors for the full comment shown over the page on hover, to match what's around it. */
  expandedClassName?: string;
}

/**
 * A photo's Markdown comment, at most 300px wide to keep its lines short, and cut off after a line
 * or two so it never pushes the layout around. When it's cut off, a chevron says there's more, and
 * hovering or focusing it shows the whole comment floating over what's below.
 */
function PhotoComment({
  comment,
  lines = 2,
  className,
  expandedClassName = "bg-popover text-popover-foreground border",
}: PhotoCommentProps) {
  const [ref, cutOff] = useOverflows<HTMLDivElement>();
  return (
    <div
      className="group/comment relative max-w-[300px] min-w-0 flex-1 outline-none"
      tabIndex={cutOff ? 0 : undefined}
    >
      <div className="flex items-start gap-1">
        <div ref={ref} className={cn(PROSE, "min-w-0", CLAMPS[lines], className)}>
          <Markdown remarkPlugins={MARKDOWN_PLUGINS}>{comment}</Markdown>
        </div>
        {cutOff && <ChevronDownIcon className="mt-0.5 size-3.5 shrink-0 opacity-60" aria-hidden />}
      </div>
      {cutOff && <ExpandedComment comment={comment} className={cn(className, expandedClassName)} />}
    </div>
  );
}

const CLAMPS = { 1: "line-clamp-1", 2: "line-clamp-2" };

/** The whole comment, shown over what's below while its cut-off version is hovered or focused. */
function ExpandedComment({ comment, className }: { comment: string; className: string }) {
  return (
    // The cut-off text already holds the whole comment for screen readers.
    <div
      aria-hidden
      className={cn(
        PROSE,
        "absolute -inset-x-2 -top-1.5 z-30 hidden max-h-80 overflow-y-auto rounded-md px-2 py-1.5 shadow-lg group-hover/comment:block group-focus/comment:block",
        className,
      )}
    >
      <Markdown remarkPlugins={MARKDOWN_PLUGINS}>{comment}</Markdown>
    </div>
  );
}

/** A ref for an element, and whether its content is taller than it, kept up to date as it resizes. */
function useOverflows<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, overflows] as const;
}
