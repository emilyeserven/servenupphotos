import { useMutation } from "@tanstack/react-query";
import { SearchCheckIcon } from "lucide-react";
import { findSimilarPhotosMutation } from "@/api/similar-photos";
import { ErrorText } from "@/components/bulk-tagging/pick-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/**
 * Find Similar Photos: has the backend compare every photo with every other and save each one's
 * most similar photos in its JSON, waiting for Commit, so the portfolio's More like this drawer
 * only reads them.
 */
export function FindSimilarCard() {
  const find = useMutation(findSimilarPhotosMutation);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Find similar photos</CardTitle>
        <CardDescription>
          Compares every photo with every other by the tags, genres and albums they share, where and
          on which day they were taken, and how much of them is the same colors. Each photo keeps
          its 6 closest matches, which the portfolio&apos;s More like this drawer shows after any
          photos picked by hand below. Run it again after adding or tagging photos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button className="self-start" disabled={find.isPending} onClick={() => find.mutate()}>
          {find.isPending ? <Spinner /> : <SearchCheckIcon aria-hidden />}
          Find similar photos
        </Button>
        <ErrorText error={find.error} />
        {find.data && (
          <p className="text-sm">
            Saved new similar photos on {find.data.photos} of {find.data.photoFiles} photos, waiting
            for Commit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
