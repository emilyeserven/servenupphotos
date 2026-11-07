import { type MouseEvent, useState } from "react";
import { cn } from "@portfolio/lib/utils";

/** Whether the element's text is cut off, along its line or under its last line. */
function isCut(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
}

/**
 * Text cut off with an ellipsis when it doesn't fit, such as a long album name in **Groups**, that
 * shows all of it on hover while it's cut off. `className` replaces `truncate`, such as
 * `line-clamp-2` for two lines.
 */
export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const [title, setTitle] = useState<string>();
  const check = (event: MouseEvent<HTMLElement>) =>
    setTitle(isCut(event.currentTarget) ? text : undefined);
  return (
    <span title={title} onMouseEnter={check} className={cn("min-w-0", className ?? "truncate")}>
      {text}
    </span>
  );
}
