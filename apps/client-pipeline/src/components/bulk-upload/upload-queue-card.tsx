import { Link } from "@tanstack/react-router";
import { BulkQueue } from "@/components/bulk-upload/bulk-upload-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBulkUploadStore } from "@/stores/bulk-upload";

/** The upload queue on the Status page, while there's anything in it. */
export function UploadQueueCard() {
  const count = useBulkUploadStore((state) => state.photos.length);
  if (count === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload queue</CardTitle>
        <CardDescription>
          Photos being uploaded to R2 and added to the batch, from{" "}
          <Link to="/bulk-upload" className="text-foreground underline underline-offset-4">
            Bulk Upload
          </Link>{" "}
          or the Photo page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BulkQueue />
      </CardContent>
    </Card>
  );
}
