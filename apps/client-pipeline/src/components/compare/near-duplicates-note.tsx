import { Link } from "@tanstack/react-router";
import { ScaleIcon } from "lucide-react";
import type { NearDuplicates } from "@/api/near-duplicates";

/**
 * Says a saved photo looks nearly the same as others, so it was put in a compare group with them,
 * linked to the group. Nothing when it wasn't.
 */
export function NearDuplicatesNote({ near }: { near?: NearDuplicates }) {
  if (!near) return null;
  const count = near.paths.length;
  return (
    <span className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
      <ScaleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Looks nearly the same as {count === 1 ? "1 saved photo" : `${count} saved photos`}, so
        it&apos;s in the compare group{" "}
        <Link
          to="/compare"
          search={{ group: near.group }}
          className="font-medium underline underline-offset-4"
        >
          {near.group}
        </Link>
        .
      </span>
    </span>
  );
}
