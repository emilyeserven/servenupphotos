import { CheckIcon, CircleDashedIcon } from "lucide-react";
import type { BaseFile } from "@/api/photos";
import { JsonCodeBlock } from "@/components/json-code-block";
import { JsonDiffBlock } from "@/components/json-diff-block";
import { cn } from "@/lib/utils";

/**
 * A file's JSON from the pull request, with what it changes against the base branch when the pull
 * request changes it rather than adds it, or why it couldn't be read.
 */
export function FileJson({
  file,
  baseBranch = "the base branch",
}: {
  file: BaseFile & { path: string; data?: unknown; error?: string };
  baseBranch?: string;
}) {
  if (file.error) return <p className="text-destructive text-sm">{file.error}</p>;
  if (file.base !== undefined) {
    return (
      <JsonDiffBlock value={file.data} base={file.base} title={file.path} baseBranch={baseBranch} />
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {file.baseError && (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t compare it with {baseBranch}: {file.baseError}
        </p>
      )}
      <JsonCodeBlock value={file.data} title={file.path} />
    </div>
  );
}

/** How each state of the ALLPHOTOS.json mark looks. */
const ALL_PHOTOS_MARKS = {
  in: {
    Icon: CheckIcon,
    label: (file: string) => `In ${file}`,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  // Not in it until it's committed.
  out: {
    Icon: CircleDashedIcon,
    label: (file: string) => `Not synced to ${file} yet`,
    className: "text-amber-700 dark:text-amber-400",
  },
  // Not in it yet, but it's being committed.
  pending: {
    Icon: CircleDashedIcon,
    label: (file: string) => `Not synced to ${file} yet`,
    className: "text-muted-foreground [&>svg]:animate-spin",
  },
};

function allPhotosMarkKey(inAllPhotos: boolean, rebuilding: boolean) {
  if (inAllPhotos) return "in";
  return rebuilding ? "pending" : "out";
}

/**
 * A check mark when the file's data is an entry of `allFile` (ALLPHOTOS.json unless named), or a
 * dashed circle marking it not synced when it isn't, spinning while it's committed. Nothing when either file couldn't be
 * read.
 */
export function AllPhotosMark({
  inAllPhotos,
  rebuilding,
  allFile = "ALLPHOTOS.json",
}: {
  inAllPhotos: boolean | null;
  rebuilding: boolean;
  allFile?: string;
}) {
  if (inAllPhotos === null) return null;
  const { Icon, label, className } = ALL_PHOTOS_MARKS[allPhotosMarkKey(inAllPhotos, rebuilding)];
  return (
    <span className={cn("flex items-center gap-1 text-xs font-normal", className)}>
      <Icon className="size-4" aria-hidden />
      {label(allFile)}
    </span>
  );
}
