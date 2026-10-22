import { useQuery } from "@tanstack/react-query";
import { CheckIcon, CloudUploadIcon, CropIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { missingSettings } from "@/api/connections";
import { settingsQuery } from "@/api/settings";
import { FloatingFlyout } from "@/components/floating-flyout";
import { R2Details } from "@/components/r2-upload/details";
import { type R2Action, type R2Upload, sameNameError } from "@/components/r2-upload/use-r2-upload";
import { Spinner } from "@/components/ui/spinner";

/** What the button shows. */
interface Look {
  icon: ReactNode;
  label: string;
  /** Filled while there's something to do, outlined once the photo is uploaded as it is. */
  variant: "default" | "outline";
}

const IDLE: Record<R2Action, Omit<Look, "variant">> = {
  upload: { icon: <CloudUploadIcon />, label: "Upload to R2" },
  remake: { icon: <CropIcon />, label: "Remake thumbnail" },
  done: { icon: <CheckIcon />, label: "Uploaded to R2" },
};

const PENDING: Record<R2Action, Omit<Look, "variant">> = {
  upload: { icon: <Spinner />, label: "Uploading…" },
  remake: { icon: <Spinner />, label: "Remaking thumbnail…" },
  done: { icon: <Spinner />, label: "Uploading…" },
};

const FAILED: Look = { icon: <TriangleAlertIcon />, label: "Upload to R2", variant: "default" };
const CHECKING: Look = { icon: <Spinner />, label: "Upload to R2", variant: "default" };

/** What clicking the button does for each next step; nothing once it's done. */
const RUN: Record<R2Action, ((r2: R2Upload, photo: File) => void) | undefined> = {
  upload: (r2, photo) => r2.retry(photo),
  remake: (r2) => r2.remakeSquare(),
  done: undefined,
};

/** The R2 settings still missing, or null while Settings are read. */
function useMissing(): string[] | null {
  const settings = useQuery(settingsQuery);
  return settings.data ? missingSettings("r2", settings.data) : null;
}

function lookOf(r2: R2Upload): Look {
  if (r2.pending) return { ...PENDING[r2.action], variant: "default" };
  if (r2.upload.isError) return FAILED;
  return { ...IDLE[r2.action], variant: r2.action === "done" ? "outline" : "default" };
}

/** Whether the button can only open the flyout: R2 isn't set up, or the upload waits on a new name. */
function blocked(r2: R2Upload, missing: string[] | null): boolean {
  return missing?.length !== 0 || r2.pending || Boolean(sameNameError(r2.upload.error));
}

interface R2ButtonProps {
  r2: R2Upload;
  photo: File;
}

/** What clicking the button does now, if anything more than opening the flyout. */
function runOf(r2: R2Upload, photo: File, missing: string[] | null): (() => void) | undefined {
  const run = blocked(r2, missing) ? undefined : RUN[r2.action];
  return run && (() => run(r2, photo));
}

/**
 * Floated next to the sync button: uploads the photo to R2, or remakes its Square Thumbnail when
 * the square has moved since, with a flyout of the upload's links, or of what stopped it.
 */
export function R2Button({ r2, photo }: R2ButtonProps) {
  const missing = useMissing();
  const look = missing ? lookOf(r2) : CHECKING;
  return (
    <FloatingFlyout
      {...look}
      title="R2 upload"
      onRun={runOf(r2, photo, missing)}
      disabled={r2.pending}
    >
      <R2Details r2={r2} photo={photo} missing={missing ?? []} />
    </FloatingFlyout>
  );
}
