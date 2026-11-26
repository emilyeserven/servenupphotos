import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import { combinedStatusQuery } from "@/api/photos";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { PhotoBook } from "@/lib/photo-book";
import { refreshCaptions, typedCaptionCount } from "@/lib/photo-book-captions";
import { askFirst } from "@/stores/confirm";
import { count } from "@portfolio/lib/words";

/**
 * Asks before replacing the typed captions, then reads the changes waiting for Commit from the
 * backend again, so a caption template or photo saved in another tab or window reaches the
 * captions. Answers whether it went ahead.
 */
function useRefresh(book: PhotoBook, onChange: (book: PhotoBook) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const typed = typedCaptionCount(book);
      if (typed > 0) {
        const yes = await askFirst({
          question: `Refresh ${count(typed, "typed caption")} from the caption template?`,
          note: "What was typed in them is replaced with the template's caption, filled in from each photo's data as it is now.",
          action: "Refresh captions",
        });
        if (!yes) return false;
        onChange(refreshCaptions(book));
      }
      await queryClient.fetchQuery({ ...combinedStatusQuery, staleTime: 0 });
      return true;
    },
  });
}

/** What refreshing does, and how many captions typed over it puts the template's back in. */
function RefreshNote({ typed }: { typed: number }) {
  const typedOver =
    typed > 0
      ? `, and puts the template's caption back in the ${count(typed, "caption")} typed over`
      : "";
  return (
    <p className="text-muted-foreground text-xs">
      Captions follow the caption template and the photos' data as soon as they change in this tab.
      Refreshing also picks up changes saved in another tab or window{typedOver}.
    </p>
  );
}

/**
 * **Refresh all captions** on a book's Info tab: fills every caption in from the caption template
 * and the photos' data as they are now, saved in this tab or another one, and, after asking, puts
 * the template's caption back in every one typed over.
 */
export function RefreshCaptions(props: { book: PhotoBook; onChange: (book: PhotoBook) => void }) {
  const { book, onChange } = props;
  const refresh = useRefresh(book, onChange);
  const done = refresh.isSuccess && refresh.data;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Captions</legend>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? <Spinner /> : <RotateCcwIcon />}
          Refresh all captions
        </Button>
        {done && (
          <span className="text-muted-foreground text-xs">
            Every caption is filled in from the caption template.
          </span>
        )}
      </div>
      <RefreshNote typed={typedCaptionCount(book)} />
    </fieldset>
  );
}
