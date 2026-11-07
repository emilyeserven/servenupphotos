import { ImagesIcon } from "lucide-react";
import { useState } from "react";
import { BulkUploadDialog } from "@/components/bulk-upload/bulk-upload-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Opens the Bulk Upload modal from the Dashboard. */
export function BulkUploadCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Upload</CardTitle>
        <CardDescription>
          Add many photos to the batch at once; each starts as a draft until it&apos;s named.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setOpen(true)}>
          <ImagesIcon aria-hidden />
          Bulk Upload
        </Button>
      </CardContent>
      <BulkUploadDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
