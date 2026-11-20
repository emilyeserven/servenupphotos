import { CircleHelpIcon, Undo2Icon } from "lucide-react";
import type { PublishedFile } from "@/api/photos";
import { BulkMarkCard } from "@/components/gallery/bulk-mark-card";
import { useSetUndecided } from "@/components/undecided-photos";

interface BulkUndecidedProps {
  files: PublishedFile[];
  selection: ReadonlySet<string>;
}

/**
 * Sends every chosen photo to Undecided, or moves it back, as changes waiting for Commit: an
 * Undecided photo stays saved as a draft the portfolio doesn't show, even with a title.
 */
export function BulkUndecided({ files, selection }: BulkUndecidedProps) {
  const setUndecided = useSetUndecided();
  return (
    <BulkMarkCard
      files={files}
      selection={selection}
      title="Undecided"
      description="Set photos aside until you decide on them. They stay saved as drafts the portfolio doesn't show, even with a title, and wait in the Undecided panel on Photos in Flight. The Gallery hides Undecided photos until Show → Undecided is on."
      markLabel={(photos) => `Send ${photos} to Undecided`}
      markIcon={<CircleHelpIcon />}
      clearLabel="Move back"
      clearIcon={<Undo2Icon />}
      doneMessage={(marked, photos) =>
        marked ? `Sent ${photos} to Undecided.` : `Moved ${photos} back from Undecided.`
      }
      setMark={setUndecided}
    />
  );
}
