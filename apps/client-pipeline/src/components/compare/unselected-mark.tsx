import { Link } from "@tanstack/react-router";
import { ArchiveXIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { InFlightFileRead } from "@/api/photos";
import { isUnselected } from "@/lib/drafts";
import { editedData } from "@/lib/undecided";
import { useLocalEditsStore } from "@/stores/local-edits";

/**
 * "Unselected", linked to Unselected Photos on the Compare page, when the photo wasn't chosen in a
 * compare group (with its local edits made); otherwise `children`, such as whether it's in
 * ALLPHOTOS.json, which leaves an unselected photo out.
 */
export function UnselectedMark({
  file,
  children,
}: {
  file: InFlightFileRead;
  children?: ReactNode;
}) {
  const edits = useLocalEditsStore((s) => s.edits);
  if (!isUnselected(editedData(file, edits))) return children;
  return (
    <Link
      to="/compare"
      hash="unselected"
      title="Not chosen in a compare group, so Commit leaves it off the portfolio"
      className="text-muted-foreground flex w-fit items-center gap-1 text-xs font-normal underline-offset-4 hover:underline"
    >
      <ArchiveXIcon className="size-3.5" aria-hidden />
      Unselected
    </Link>
  );
}
