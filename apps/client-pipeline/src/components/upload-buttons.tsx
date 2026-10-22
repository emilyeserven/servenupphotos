import { useLocation, useNavigate } from "@tanstack/react-router";
import { ImagesIcon, UploadIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { BulkUploadPanel } from "@/components/bulk-upload/bulk-upload-panel";
import { DropZone } from "@/components/bulk-upload/drop-zone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePendingPhotoStore } from "@/stores/pending-photo";

type Open = "single" | "bulk" | null;

/** Closes whichever modal is open when the page changes, as when a photo's Edit is clicked. */
function useCloseOnNavigate(close: () => void) {
  const pathname = useLocation({ select: (location) => location.pathname });
  useEffect(close, [pathname, close]);
}

/**
 * The sidebar's split Upload button: its main part picks one photo for the Photo page, and its right
 * part, the Bulk Upload icon, adds many to the batch. Both open in a modal.
 */
export function UploadButtons({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState<Open>(null);
  const [close] = useState(() => () => setOpen(null));
  useCloseOnNavigate(close);

  return (
    <>
      {/* In the collapsed sidebar the two parts stack as icon buttons. */}
      <div
        className="flex px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-0"
        role="group"
        aria-label="Upload"
      >
        <Button
          className="flex-1 rounded-r-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:rounded-md"
          title="Upload"
          onClick={() => setOpen("single")}
        >
          <UploadIcon aria-hidden />
          <span className="group-data-[collapsible=icon]:sr-only">Upload</span>
        </Button>
        <Button
          size="icon"
          className="border-primary-foreground/25 rounded-l-none border-l group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:border-l-0"
          title="Bulk Upload"
          aria-label="Bulk Upload"
          onClick={() => setOpen("bulk")}
        >
          <ImagesIcon aria-hidden />
        </Button>
      </div>
      <SingleUploadDialog open={open === "single"} onClose={close} onNavigate={onNavigate} />
      <BulkUploadDialog open={open === "bulk"} onClose={close} />
    </>
  );
}

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
}

function SingleUploadDialog({
  open,
  onClose,
  onNavigate,
}: UploadDialogProps & { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const choose = usePendingPhotoStore((state) => state.choose);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a photo</DialogTitle>
          <DialogDescription>
            Choose one JPEG to analyze, then set its title, crop, albums and tags before adding it
            to the batch.
          </DialogDescription>
        </DialogHeader>
        <DropZone
          single
          onFiles={([photo]) => {
            if (!photo) return;
            choose(photo);
            onNavigate?.();
            void navigate({ to: "/exif" });
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function BulkUploadDialog({ open, onClose }: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload</DialogTitle>
          <DialogDescription>
            Each photo gets its file name as its title and the middle square as its Square
            Thumbnail; change either afterward with Edit. This closes once they're added, and the
            sync button shows how the uploads are going.
          </DialogDescription>
        </DialogHeader>
        <BulkUploadPanel onAdded={onClose} />
      </DialogContent>
    </Dialog>
  );
}
