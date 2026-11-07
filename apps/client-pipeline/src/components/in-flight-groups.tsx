import { useState } from "react";
import type { InFlightGroupFile, InFlightGroups, InFlightResponse } from "@/api/photos";
import { CollapsiblePanel, countOf } from "@/components/collapsible-panel";
import { fileName } from "@/components/in-flight-checks";
import { AllPhotosMark, FileJson } from "@/components/in-flight-file-json";
import { FileLink, FileStatus } from "@/components/in-flight-pending";
import { lineChanges } from "@/lib/json-changes";
import { cn } from "@/lib/utils";

type GroupKey =
  | "albums"
  | "tags"
  | "genres"
  | "places"
  | "localizations"
  | "metainfo"
  | "cameras"
  | "lenses"
  | "captions"
  | "timeline"
  | "likes"
  | "triplines"
  | "graphs"
  | "gear";

/** The kinds of data files listed after the photos, in order, with their headings. */
const GROUPS: [GroupKey, string][] = [
  ["albums", "Albums"],
  ["tags", "Tags"],
  ["genres", "Photographic genres"],
  ["places", "Places"],
  ["localizations", "Localizations"],
  ["metainfo", "Metadata groups"],
  ["cameras", "Camera overrides"],
  ["lenses", "Custom lenses"],
  ["captions", "Caption templates"],
  ["timeline", "Trips"],
  ["likes", "User likes"],
  ["triplines", "Trip lines"],
  ["graphs", "Graph presets"],
  ["gear", "Gear pictures"],
];

interface GroupFilesProps {
  title: string;
  groups: InFlightGroups;
  /** Whether the combined files are being committed, so a missing entry may be on its way. */
  rebuilding: boolean;
  /** The branch the pull request merges into, which changed files are compared against. */
  baseBranch?: string;
}

/**
 * The album, tag, place or other data files in the pull request, in a section collapsed to its
 * count. Opened, it shows two panels: the files by name with how many lines each adds and removes,
 * and the selected file's JSON. Nothing when there are none.
 */
function GroupFiles({ title, groups, ...props }: GroupFilesProps) {
  if (groups.files.length === 0) return null;
  return (
    <CollapsiblePanel title={title} count={countOf(groups.files.length, "file")}>
      <GroupPanels groups={groups} {...props} />
    </CollapsiblePanel>
  );
}

/** The list of files beside the selected one's JSON, stacked on narrow screens. */
function GroupPanels({ groups, rebuilding, baseBranch }: Omit<GroupFilesProps, "title">) {
  const [selectedPath, setSelectedPath] = useState(groups.files[0]?.path);
  const selected = groups.files.find((file) => file.path === selectedPath) ?? groups.files[0];
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <ul className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto">
        {groups.files.map((file) => (
          <GroupFileButton
            key={file.path}
            file={file}
            selected={file.path === selected?.path}
            onSelect={() => setSelectedPath(file.path)}
          />
        ))}
      </ul>
      {selected && (
        <SelectedFile
          file={selected}
          allFile={fileName(groups.all.path)}
          rebuilding={rebuilding}
          baseBranch={baseBranch}
        />
      )}
    </div>
  );
}

/** What to call the file in the list: its `name`, or else its file name. */
function groupFileName(file: InFlightGroupFile): string {
  const name = (file.data as { name?: unknown } | null | undefined)?.name;
  return typeof name === "string" && name.trim() ? name : fileName(file.path);
}

/** One file in the list: its name, and how many lines it adds and removes. */
function GroupFileButton({
  file,
  selected,
  onSelect,
}: {
  file: InFlightGroupFile;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
          selected && "bg-muted font-medium",
        )}
      >
        <span className="min-w-0 flex-1 truncate" title={fileName(file.path)}>
          {groupFileName(file)}
        </span>
        <LineCounts file={file} />
      </button>
    </li>
  );
}

/** "+3 −1" for the lines the file adds and removes, or "!" when it couldn't be read. */
function LineCounts({ file }: { file: InFlightGroupFile }) {
  const changes = lineChanges(file);
  if (!changes) return <span className="text-destructive font-mono text-xs">!</span>;
  return (
    <span className="flex shrink-0 gap-1 font-mono text-xs">
      <span className="text-emerald-600 dark:text-emerald-400">+{changes.added}</span>
      <span className="text-red-600 dark:text-red-400">−{changes.removed}</span>
    </span>
  );
}

/** The selected file's name, status and whether it's in the combined file, over its JSON. */
function SelectedFile({
  file,
  allFile,
  rebuilding,
  baseBranch,
}: {
  file: InFlightGroupFile;
  allFile: string;
  rebuilding: boolean;
  baseBranch?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
        <FileLink fileUrl={file.fileUrl} name={fileName(file.path)} />
        <FileStatus status={file.status} pending={file.pending} />
        <AllPhotosMark inAllPhotos={file.inAll} rebuilding={rebuilding} allFile={allFile} />
      </h3>
      <FileJson file={file} baseBranch={baseBranch} />
    </div>
  );
}

/** Every kind of data file in the pull request, each in its own collapsed section. */
export function AllGroupFiles({
  shown,
  ...props
}: {
  shown: InFlightResponse;
  rebuilding: boolean;
  baseBranch?: string;
}) {
  return GROUPS.map(([key, title]) => (
    <GroupFiles key={key} title={title} groups={shown[key]} {...props} />
  ));
}
