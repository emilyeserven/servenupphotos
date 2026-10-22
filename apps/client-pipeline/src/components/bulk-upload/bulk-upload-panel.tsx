import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { missingSettings } from "@/api/connections";
import { type SettingsResponse, settingsQuery } from "@/api/settings";
import { BulkPhotoRow } from "@/components/bulk-upload/bulk-photo-row";
import { DropZone } from "@/components/bulk-upload/drop-zone";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import type { BulkPhoto, BulkStep } from "@/lib/bulk-upload";
import { useBulkUploadStore } from "@/stores/bulk-upload";

/** Bulk Upload's drop zone and queue, as its page and the sidebar's Bulk Upload modal show them. */
export function BulkUploadPanel() {
  const settings = useQuery(settingsQuery);
  return (
    <QueryResult query={settings} pendingLabel="Loading settings…">
      {(data) => <BulkUpload settings={data} />}
    </QueryResult>
  );
}

/** What's missing from Settings for the photos to be uploaded and saved, if anything. */
function missingAll(settings: SettingsResponse): string[] {
  return [
    ...missingSettings("r2", settings).map((name) => `R2 ${name}`),
    ...missingSettings("github", settings).map((name) => `GitHub ${name}`),
  ];
}

function BulkUpload({ settings }: { settings: SettingsResponse }) {
  const queryClient = useQueryClient();
  const add = useBulkUploadStore((state) => state.add);
  const missing = missingAll(settings);

  return (
    <div className="flex flex-col gap-4">
      {missing.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Add the {missing.join(", ")} in{" "}
          <Link to="/settings" className="text-foreground underline underline-offset-4">
            Settings
          </Link>{" "}
          first.
        </p>
      )}
      <DropZone onFiles={(files) => add(files, queryClient)} disabled={missing.length > 0} />
      <BulkQueue />
    </div>
  );
}

function countOf(photos: BulkPhoto[], ...steps: BulkStep[]): number {
  return photos.filter((photo) => steps.includes(photo.step)).length;
}

/** How the queue is going, such as "3 of 10 added · 1 skipped · 1 failed". */
function summary(photos: BulkPhoto[]): string {
  const parts = [`${countOf(photos, "added")} of ${photos.length} added`];
  const skipped = countOf(photos, "skipped");
  const failed = countOf(photos, "failed");
  if (skipped > 0) parts.push(`${skipped} already saved`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(" · ");
}

/** The chosen photos, each with where it is, under a bar of how many are done. */
export function BulkQueue() {
  const photos = useBulkUploadStore((state) => state.photos);
  const clearFinished = useBulkUploadStore((state) => state.clearFinished);
  if (photos.length === 0) return null;
  const done = countOf(photos, "added", "skipped", "failed");

  return (
    <section aria-label="Queue" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{summary(photos)}</p>
        <Button
          variant="outline"
          size="sm"
          disabled={countOf(photos, "added", "skipped") === 0}
          onClick={clearFinished}
        >
          Clear finished
        </Button>
      </div>
      <div
        role="progressbar"
        aria-label="Photos done"
        aria-valuemin={0}
        aria-valuemax={photos.length}
        aria-valuenow={done}
        className="bg-muted h-2 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full transition-[width]"
          style={{ width: `${(done / photos.length) * 100}%` }}
        />
      </div>
      <ul className="divide-y">
        {photos.map((photo) => (
          <BulkPhotoRow key={photo.id} photo={photo} />
        ))}
      </ul>
    </section>
  );
}
