import type { SocialPhoto } from "@/api/publish";
import { ImportReview } from "@/components/book-import/import-review";
import { PasteAnswer } from "@/components/paste-answer";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import { readBookImport } from "@/lib/book-import";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Import: the box the LLM's answer is pasted into, read against every photo file (not only the
 * catalog's, so an answer for wider dates still matches), and the review that saves it.
 */
export function AnswerCard({ photos }: { photos: SocialPhoto[] }) {
  const pasted = usePastedAnswer((text) => readBookImport(text, photos));
  const combined = useCombinedData();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <CardDescription>
          Paste the LLM&apos;s answer to see the book&apos;s pages and which photos aren&apos;t on
          the website, then make the album and the photo book.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <PasteAnswer pasted={pasted} label="Read the book" />
        {pasted.answer && (
          <QueryResult query={combined} pendingLabel="Reading the albums and photo books…">
            {(data) =>
              pasted.answer && (
                <ImportReview
                  key={pasted.reviews}
                  read={pasted.answer}
                  data={data}
                  photos={photos}
                />
              )
            }
          </QueryResult>
        )}
      </CardContent>
    </Card>
  );
}
