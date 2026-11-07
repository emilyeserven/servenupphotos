import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { r2ExifPreviewQuery } from "@/api/r2-exif";
import { QueryResult } from "@/components/query-result";
import { R2ExifList } from "@/components/r2-exif/r2-exif-list";
import { ReadProgressView } from "@/components/read-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface R2ExifCardProps {
  /** Whether R2 is set up, so the originals can be read and written. */
  canRead: boolean;
}

/**
 * Finds the photos whose originals in R2 have EXIF that doesn't match their photo files, and writes
 * the fields already changed in Lightroom into an original after a confirm step.
 */
export function R2ExifCard({ canRead }: R2ExifCardProps) {
  const [checking, setChecking] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>EXIF in R2</CardTitle>
        <CardDescription>
          Checks each photo&apos;s original JPEG in R2 against its photo file and lists where the
          EXIF doesn&apos;t match what the pipeline shows, such as a time fixed by Times across
          timezones or a lens renamed by a camera override. Make each change in Lightroom first,
          tick it as done there, then confirm to write the ticked fields over that original in R2;
          nothing is written until you do. It downloads every original the first time, so it takes a
          while.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {!canRead && (
          <p className="text-muted-foreground text-sm">
            Set up Cloudflare R2 in Settings to read the originals.
          </p>
        )}
        {checking ? (
          <R2ExifResults />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={!canRead}
            onClick={() => setChecking(true)}
          >
            Check the originals
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** The check's result, with a button to run it again. */
function R2ExifResults() {
  const preview = useQuery(r2ExifPreviewQuery);
  return (
    <section aria-label="Originals in R2" className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={preview.isFetching}
        onClick={() => void preview.refetch()}
      >
        Check again
      </Button>
      <QueryResult
        query={preview}
        pending={<ReadProgressView task="r2-exif" label="Reading the photo JSON…" />}
      >
        {(data) => <R2ExifList preview={data} />}
      </QueryResult>
    </section>
  );
}
