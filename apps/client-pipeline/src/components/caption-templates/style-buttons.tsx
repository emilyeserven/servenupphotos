import { ArrowDownToLineIcon, ItalicIcon, LinkIcon, TypeIcon } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { type TextMark, withGap, withMark } from "@/lib/caption-styles";

interface StyleButtonsProps {
  /** The template's text box, whose selection the buttons mark. */
  field: RefObject<HTMLTextAreaElement | null>;
  text: string;
  onChange: (text: string) => void;
}

/**
 * **Smaller** and **Italic** under the template's text box, which put `<small>…</small>` or
 * `<i>…</i>` around what's selected in it (both, pressed one after the other), and **Space above**,
 * which starts the cursor's line with `<gap />`, for the Photo Book's captions; a social media post gets the text without them.
 * **Keep together** puts `<nobr>…</nobr>` around it, so a line never breaks inside that part.
 */
export function StyleButtons({ field, text, onChange }: StyleButtonsProps) {
  const mark = (name: TextMark) => onChange(withMark(text, field.current, name));
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
      <Button variant="outline" size="sm" onClick={() => mark("nobr")}>
        <LinkIcon />
        Keep together
      </Button>
      <span className="text-muted-foreground text-xs">
        Marks the selected text with {"<small>…</small>"} or {"<i>…</i>"}, or both, and the
        cursor&apos;s line with {"<gap />"} for a quarter line of room above it, for Photo Book
        captions. {"<nobr>…</nobr>"} keeps a part on one line, such as {"<nobr>ISO {iso}</nobr>"}.
        Social media posts get the text without them.
      </span>
    </div>
  );
}
