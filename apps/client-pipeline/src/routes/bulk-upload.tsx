import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { missingSettings } from "@/api/connections";
import { type SettingsResponse, settingsQuery } from "@/api/settings";
import { BulkPhotoRow } from "@/components/bulk-upload/bulk-photo-row";
import { DropZone } from "@/components/bulk-upload/drop-zone";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BulkPhoto, BulkStep } from "@/lib/bulk-upload";
import { useBulkUploadStore } from "@/stores/bulk-upload";

export const Route = createFileRoute("/bulk-upload")({
  component: BulkUploadPage,
});

function BulkUploadPage() {
  const settings = useQuery(settingsQuery);
  return (
    <Page
      title="Bulk Upload"
      description="Add many photos to the batch at once. Each gets its file name as its title and the middle square as its Square Thumbnail; change either afterward with Edit."
    >
      <QueryResult query={settings} pendingLabel="Loading settings…">
        {(data) => <BulkUpload settings={data} />}
      </QueryResult>
    </Page>
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>
            For one photo with its title, crop, albums and tags set first, use the{" "}
            <Link to="/exif" className="text-foreground underline underline-offset-4">
              Photo
            </Link>{" "}
            page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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
        </CardContent>
      </Card>
      <Queue />
    </>
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
function Queue() {
  const photos = useBulkUploadStore((state) => state.photos);
  const clearFinished = useBulkUploadStore((state) => state.clearFinished);
  if (photos.length === 0) return null;
  const done = countOf(photos, "added", "skipped", "failed");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue</CardTitle>
        <CardDescription>{summary(photos)}</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={countOf(photos, "added", "skipped") === 0}
            onClick={clearFinished}
          >
            Clear finished
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
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
      </CardContent>
    </Card>
  );
}
