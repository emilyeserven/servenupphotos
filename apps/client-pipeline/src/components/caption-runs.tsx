import { captionRuns, runClass } from "@/lib/caption-styles";

/**
 * A caption's text drawn with its style marks: `<small>` stretches at 80% of the size around them
 * and `<i>` ones in italics, the marks themselves not shown.
 */
export function CaptionRuns({ text }: { text: string }) {
  return captionRuns(text).map((run, i) => (
    <span key={i} className={runClass(run)}>
      {run.text}
    </span>
  ));
}
