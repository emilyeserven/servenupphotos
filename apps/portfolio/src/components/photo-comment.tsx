import { ChevronDownIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";

/** Markdown's lists, links, code and quotes, which Tailwind's reset strips, kept compact for a caption. */
const PROSE =
  "break-words [&_p+*]:mt-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-4 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-current/10 [&_code]:px-1 [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-2 [&_h1,&_h2,&_h3]:font-medium";

/** Keeps each line break written in the comment, not only blank lines between paragraphs. */
const MARKDOWN_PLUGINS = [remarkBreaks];

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
export function PhotoComment({
  comment,
  lines = 2,
  className,
  expandedClassName = "bg-popover text-popover-foreground border",
}: PhotoCommentProps) {
  const [ref, cutOff] = useOverflows<HTMLDivElement>();
  return (
    <div
      className="group/comment relative max-w-[300px] min-w-0 outline-none"
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
