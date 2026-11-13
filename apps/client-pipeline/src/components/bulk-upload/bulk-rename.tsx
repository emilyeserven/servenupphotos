import { useQueryClient } from "@tanstack/react-query";
import { RenameForm } from "@/components/rename-prompt";
import { type BulkPhoto, renamed } from "@/lib/bulk-upload";
import { jsonNameProblem, uploadNameProblem } from "@/lib/file-name";
import { useBulkUploadStore } from "@/stores/bulk-upload";

/** Renaming a photo's file before it's uploaded to R2. */
const UPLOAD_NAME = {
  extension: ".jpg",
  submitLabel: "Rename and upload",
  validate: uploadNameProblem,
};

/** Renaming a photo's JSON once it's in R2. */
const JSON_NAME = { extension: ".json", submitLabel: "Rename and save", validate: jsonNameProblem };

/**
 * Under a photo whose name was taken, in R2 or by another photo's JSON: a new name, filled in with
 * a free one the backend offered, and a button that renames it and tries again from that step.
 */
export function BulkRename({ photo }: { photo: BulkPhoto }) {
  const queryClient = useQueryClient();
  const retry = useBulkUploadStore((state) => state.retry);
  if (!photo.suggestedName) return null;
  return (
    <RenameForm
      key={photo.suggestedName}
      id={`${photo.id}-name`}
      suggested={photo.suggestedName}
      {...(photo.upload ? JSON_NAME : UPLOAD_NAME)}
      onRename={(name) => retry(photo.id, queryClient, renamed(photo, name))}
    />
  );
}
