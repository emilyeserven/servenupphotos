import { Link } from "@tanstack/react-router";
import { ScaleIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { InFlightFileRead } from "@/api/photos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { useCompareEdits, useCompareGroups } from "@/hooks/use-compare-groups";
import { canCompare, compareGroupOf } from "@/lib/compare-groups";
import { editedData } from "@/lib/undecided";
import { cn } from "@/lib/utils";
import { useLocalEditsStore } from "@/stores/local-edits";

/** The compare group the file is in with its local edits made, or undefined when it's in none. */
function useGroupOf(file: InFlightFileRead): string | undefined {
  const edits = useLocalEditsStore((s) => s.edits);
  return compareGroupOf(editedData(file, edits));
}

/**
 * A button that puts the photo in a compare group, to weigh it head-to-head against other photos
 * before deciding which gets posted, or names the group it's in. Nothing for a photo whose JSON
 * couldn't be read or that's being removed.
 */
export function CompareButton({
  file,
  className,
}: {
  file: InFlightFileRead & { inFlight?: string };
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const group = useGroupOf(file);
  if (!canCompare(file)) return null;
  return (
    <>
      <GroupButton group={group} className={className} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compare group</DialogTitle>
            <DialogDescription>
              Photos in a group are weighed head-to-head on the Compare page, to pick the one that
              gets posted. Groups are only in the pipeline; the portfolio never shows them.
            </DialogDescription>
          </DialogHeader>
          {open && <GroupChooser file={file} group={group} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** How the button looks: named after the photo's group when it's in one, or else "Compare". */
function buttonLook(group: string | undefined) {
  if (!group)
    return {
      variant: "ghost" as const,
      className: "text-muted-foreground",
      title: "Compare it head-to-head with others",
      label: "Compare",
    };
  return { variant: "secondary" as const, title: `In the compare group “${group}”`, label: group };
}

function GroupButton({
  group,
  className,
  onClick,
}: {
  group?: string;
  className?: string;
  onClick: () => void;
}) {
  const look = buttonLook(group);
  return (
    <Button
      variant={look.variant}
      size="sm"
      className={cn("max-w-full min-w-0", look.className, className)}
      title={look.title}
      onClick={onClick}
    >
      <ScaleIcon />
      <span className="truncate">{look.label}</span>
    </Button>
  );
}

/** The groups to choose from, as combobox options, with how many photos each has. */
function useGroupOptions() {
  const { groups } = useCompareGroups();
  return groups.map((group) => ({
    value: group.name,
    label: group.name,
    detail: group.photos.length === 1 ? "1 photo" : `${group.photos.length} photos`,
  }));
}

/** Chooses an existing group or names a new one, with Open and Remove when the photo is in one. */
function GroupChooser({
  file,
  group,
  onDone,
}: {
  file: InFlightFileRead;
  group?: string;
  onDone: () => void;
}) {
  const options = useGroupOptions();
  const { setGroup } = useCompareEdits();
  const choose = (name: string) => {
    if (name.trim()) setGroup([file], name.trim());
    onDone();
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span id="compare-group-label" className="text-sm font-medium">
          {group ? "Move to another group" : "Group"}
        </span>
        <SingleCombobox
          aria-labelledby="compare-group-label"
          options={options}
          value={group ?? ""}
          onChange={choose}
          placeholder="Choose a group or type a new name"
          emptyText="No groups yet. Type a name to start one."
          createLabel={(text) => `Start a group named “${text}”`}
          onCreate={choose}
        />
      </div>
      {group && <InGroupActions file={file} group={group} onDone={onDone} />}
    </div>
  );
}

/** Opens the photo's group on the Compare page, or takes the photo out of it. */
function InGroupActions({
  file,
  group,
  onDone,
}: {
  file: InFlightFileRead;
  group: string;
  onDone: () => void;
}) {
  const { setGroup } = useCompareEdits();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" asChild>
        <Link to="/compare" search={{ group }}>
          <ScaleIcon />
          Compare “{group}”
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setGroup([file], null);
          onDone();
        }}
      >
        <XIcon />
        Take out of the group
      </Button>
    </div>
  );
}
