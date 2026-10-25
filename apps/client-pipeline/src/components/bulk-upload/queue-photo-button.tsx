import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, LayersIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BulkPhotoRow } from "@/components/bulk-upload/bulk-photo-row";
import { FloatingFlyout } from "@/components/floating-flyout";
import { Spinner } from "@/components/ui/spinner";
import type { BulkPhoto, BulkStep } from "@/lib/bulk-upload";
import { type AnalyzedPhoto, useBulkUploadStore } from "@/stores/bulk-upload";

/** The photo's place in the upload queue, once the Photo page has handed it over. */
export function useQueuedPhoto(file: File | undefined): BulkPhoto | undefined {
  return useBulkUploadStore((state) => state.photos.find((photo) => photo.file === file));
}

/** What the button shows. */
interface Look {
  icon: ReactNode;
  label: string;
  variant: "default" | "outline";
}

const READY: Look = { icon: <LayersIcon />, label: "Upload & save", variant: "default" };

const RETRY: Look = { icon: <TriangleAlertIcon />, label: "Upload & save", variant: "default" };
const WORKING: Look = { icon: <Spinner />, label: "In the queue…", variant: "default" };

/** How a queued photo that's finished shows, by how it finished. */
const FINISHED: Partial<Record<BulkStep, Look>> = {
  added: { icon: <CheckIcon />, label: "Saved", variant: "outline" },
  failed: RETRY,
  skipped: RETRY,
};

/** How the queued photo is doing, as the button shows it. */
function lookOf(queued: BulkPhoto | undefined): Look {
  return queued ? (FINISHED[queued.step] ?? WORKING) : READY;
}

interface QueuePhotoButtonProps {
  /** The analyzed photo, with its title and other details, square, albums and tags as they are now. */
  photo: AnalyzedPhoto;
  /** Called once the photo is handed to the queue, so the page stops taking changes to it. */
  onQueued: () => void;
}

/**
 * Floated next to the sync button: hands the photo to the upload queue, which uploads it to R2 and
 * saves its JSON in the background, so the page can be left right away. The flyout shows how it's
 * going, as the Status page does.
 */
export function QueuePhotoButton({ photo, onQueued }: QueuePhotoButtonProps) {
  const queryClient = useQueryClient();
  const addAnalyzed = useBulkUploadStore((state) => state.addAnalyzed);
  const queued = useQueuedPhoto(photo.file);
  const run = () => {
    addAnalyzed(photo, queryClient);
    onQueued();
  };
  return (
    <FloatingFlyout {...lookOf(queued)} title="Upload and save" onRun={queued ? undefined : run}>
      <p className="font-medium">Upload and save in the background</p>
      {queued ? <QueuedDetails queued={queued} /> : <QueueIntro />}
    </FloatingFlyout>
  );
}

function QueueIntro() {
  return (
    <p className="text-muted-foreground">
      Uploads the photo to R2 with this square, then saves its JSON with its title, albums, tags and
      genres to the batch. It keeps going after you leave this page; the Status page shows how it's
      doing.
    </p>
  );
}

function QueuedDetails({ queued }: { queued: BulkPhoto }) {
  return (
    <>
      <ul>
        <BulkPhotoRow photo={queued} />
      </ul>
      <p className="text-muted-foreground">
        Changes made here now aren't saved with it; change it afterward with Edit. The{" "}
        <Link to="/" className="text-foreground underline underline-offset-4">
          Status
        </Link>{" "}
        page shows the whole queue.
      </p>
    </>
  );
}
