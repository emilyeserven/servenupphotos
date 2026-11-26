import { captionLines, lineClass, runClass } from "@/lib/caption-styles";

/**
 * A caption's text drawn with its style marks, line by line: `<small>` stretches at 80% of the size
 * around them (a line smaller all through with a line height to match), `<i>` ones in italics, and
 * a line with `<gap>` half a line lower; the marks themselves not shown.
 */
export function CaptionRuns({ text }: { text: string }) {
  return captionLines(text).map((line, i) => (
    <span key={i} className={lineClass(line)}>
      {line.runs.length === 0
        ? "\u00a0"
        : line.runs.map((run, j) => (
            <span key={j} className={runClass(run)}>
              {run.text}
            </span>
          ))}
    </span>
  ));
}
