import { captionLines, lineClass, runClass } from "@/lib/caption-styles";

/**
 * A caption's text drawn with its style marks, line by line: `<small>` stretches at 80% of the size
 * around them (a line smaller all through with a line height to match), `<i>` ones in italics, and
 * a line with `<gap />` a quarter line lower; the marks themselves not shown. Each line takes its
 * reading direction from its first letter, so an Arabic or Hebrew place name reads right to left,
 * with its commas between its parts and its wrapped words in order, while English lines stay left
 * to right.
 */
export function CaptionRuns({ text }: { text: string }) {
  return captionLines(text).map((line, i) => (
    <span key={i} dir="auto" className={lineClass(line)}>
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
