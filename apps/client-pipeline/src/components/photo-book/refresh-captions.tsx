import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PhotoBook } from "@/lib/photo-book";
import { refreshCaptions, typedCaptionCount } from "@/lib/photo-book-captions";
import { askFirst } from "@/stores/confirm";
import { count } from "@portfolio/lib/words";

/**
 * **Refresh all captions** on a book's Info tab: after asking, every caption typed over is filled
 * in from the caption template again, with the photos' data as it is now. Off while none is typed
 * over, since the others already follow the template and the photos' data.
 */
export function RefreshCaptions(props: { book: PhotoBook; onChange: (book: PhotoBook) => void }) {
  const { book, onChange } = props;
  const typed = typedCaptionCount(book);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Captions</legend>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={typed === 0}
          onClick={async () => {
            const yes = await askFirst({
              question: `Refresh ${count(typed, "typed caption")} from the caption template?`,
              note: "What was typed in them is replaced with the template's caption, filled in from each photo's data as it is now.",
              action: "Refresh captions",
            });
            if (yes) onChange(refreshCaptions(book));
          }}
        >
          <RotateCcwIcon />
          Refresh all captions
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {typed === 0
          ? "Every caption is filled in from the caption template, so it already shows each photo's data as it is now."
          : `${count(typed, "caption is", "captions are")} typed over instead of filled in from the caption template. Refreshing fills them in from the template again, as From template does for one.`}
      </p>
    </fieldset>
  );
}
