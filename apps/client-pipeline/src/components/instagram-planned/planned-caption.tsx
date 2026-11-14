import { type CaptionTemplate } from "@/api/captions";
import { CopyTextButton } from "@/components/copy-text";
import { NoTemplates } from "@/components/generate-caption";

interface PlannedCaptionProps {
  caption: string;
  /** The default Instagram template the caption was made from; undefined when there's none. */
  template: CaptionTemplate | undefined;
  /** Whether the caption is the one written on the post, rather than made from the template. */
  written: boolean;
}

/** Where the caption came from, under its heading. */
function sourceNote(template: CaptionTemplate | undefined, written: boolean): string {
  if (written) return "Written on the photo's Instagram post.";
  return `From the ${template?.name ?? "default"} caption template.`;
}

/** The caption to paste into Instagram, with a button that copies it. */
export function PlannedCaption({ caption, template, written }: PlannedCaptionProps) {
  if (!written && !template) return <NoTemplates />;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="planned-caption">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 id="planned-caption" className="text-sm font-medium">
            Caption
          </h2>
          <p className="text-muted-foreground text-xs">{sourceNote(template, written)}</p>
        </div>
        <CopyTextButton label="Copy caption" size="lg" title="The caption" text={() => caption} />
      </div>
      <pre className="bg-muted/40 max-h-80 overflow-auto rounded-md border p-3 font-sans text-sm whitespace-pre-wrap">
        {caption || "The template made an empty caption for this photo."}
      </pre>
    </section>
  );
}
