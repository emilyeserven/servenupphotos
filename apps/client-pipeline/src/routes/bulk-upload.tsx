import { Link, createFileRoute } from "@tanstack/react-router";
import { BulkUploadPanel } from "@/components/bulk-upload/bulk-upload-panel";
import { Page } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/bulk-upload")({
  component: BulkUploadPage,
});

function BulkUploadPage() {
  return (
    <Page
      title="Bulk Upload"
      description="Add many photos to the batch at once. Each gets its file name as its title and the middle square as its Square Thumbnail; change either afterward with Edit."
    >
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
        <CardContent>
          <BulkUploadPanel />
        </CardContent>
      </Card>
    </Page>
  );
}
