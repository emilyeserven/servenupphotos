import { EyeIcon, PencilIcon } from "lucide-react";
import { useId, useState } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { MARKDOWN_CLASSES } from "@/components/photo-details";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Keeps each line break written, as the portfolio shows it. */
const MARKDOWN_PLUGINS = [remarkBreaks];

/** A labelled box for Markdown text, with a button that shows it as the portfolio renders it. */
export function MarkdownField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [preview, setPreview] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-muted-foreground text-xs font-medium">
          {label} <span className="font-normal">(Markdown)</span>
        </label>
        <Button size="xs" variant="ghost" onClick={() => setPreview(!preview)}>
          {preview ? <PencilIcon aria-hidden /> : <EyeIcon aria-hidden />}
          {preview ? "Write" : "Preview"}
        </Button>
      </div>
      {preview ? (
        <MarkdownPreview text={value} />
      ) : (
        <Textarea
          id={id}
          value={value}
          placeholder="None"
          className="min-h-10"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-muted-foreground min-h-10 py-2 text-xs">No text.</p>;
  return (
    <div className={`${MARKDOWN_CLASSES} bg-muted/40 min-h-10 rounded-md border px-2 py-2`}>
      <Markdown remarkPlugins={MARKDOWN_PLUGINS}>{text}</Markdown>
    </div>
  );
}
