import { ArrowDownToLineIcon, ItalicIcon, TypeIcon } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { withGap, withMark } from "@/lib/caption-styles";

interface StyleButtonsProps {
  /** The template's text box, whose selection the buttons mark. */
  field: RefObject<HTMLTextAreaElement | null>;
  text: string;
  onChange: (text: string) => void;
}

/**
 * **Smaller** and **Italic** under the template's text box, which put `<small>…</small>` or
 * `<i>…</i>` around what's selected in it (both, pressed one after the other), and **Space above**,
 * which starts the cursor's line with `<gap>`, for the Photo Book's captions; a social media post gets the text without them.
 */
export function StyleButtons({ field, text, onChange }: StyleButtonsProps) {
  const mark = (name: "small" | "i") => onChange(withMark(text, field.current, name));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => mark("small")}>
        <TypeIcon />
        Smaller
      </Button>
      <Button variant="outline" size="sm" onClick={() => mark("i")}>
        <ItalicIcon />
        Italic
      </Button>
      <Button variant="outline" size="sm" onClick={() => onChange(withGap(text, field.current))}>
        <ArrowDownToLineIcon />
        Space above
      </Button>
      <span className="text-muted-foreground text-xs">
        Marks the selected text with {"<small>…</small>"} or {"<i>…</i>"}, or both, and the
        cursor&apos;s line with {"<gap>"} for half a line of room above it, for Photo Book captions.
        Social media posts get the text without them.
      </span>
    </div>
  );
}
