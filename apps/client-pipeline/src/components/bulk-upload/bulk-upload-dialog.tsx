import { BulkUploadPanel } from "@/components/bulk-upload/bulk-upload-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BulkUploadDialogProps {
  open: boolean;
  onClose: () => void;
}

/** The Bulk Upload modal, opened from the sidebar's Upload button and the Dashboard. */
export function BulkUploadDialog({ open, onClose }: BulkUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload</DialogTitle>
          <DialogDescription>
            Each photo gets its file name as its title and the middle square as its Square
            Thumbnail; change either afterward with Edit. This closes once they&apos;re added, and
            the sync button shows how the uploads are going.
          </DialogDescription>
        </DialogHeader>
        <BulkUploadPanel onAdded={onClose} />
      </DialogContent>
    </Dialog>
  );
}
