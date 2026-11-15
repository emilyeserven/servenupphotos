import { Link } from "@tanstack/react-router";
import { CheckIcon, ExternalLinkIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { count } from "@/components/update-data-shared";
import type { AutogroupPhoto } from "@/lib/compare-autogroup";
import { titleOf } from "@/lib/drafts";
import { NOTES, RE_EDIT } from "@/lib/photo-fields";
import { type QualityFlag, alreadyFlagged, flaggedNotes, flaggedReEdit } from "@/lib/quality-flags";
import { useLocalEditsStore } from "@/stores/local-edits";

/** A photo that failed a Quality Check, with what failed and the re-edit flag it gets. */
export interface FlagItem {
  entry: AutogroupPhoto;
  flag: QualityFlag;
  /** What the check found, such as "640 × 427 (3:2), 6.3% off 16:9". */
  detail: string;
}

interface FlagListProps {
  items: FlagItem[];
  /** The text of each photo's link to the Photo page, such as "Pixelate faces". */
  linkLabel: string;
}

/**
 * The photos that failed a check, each with its Small version, what failed and a link to fix it
 * on the Photo page's Image section, and a button that marks the ticked ones for re-editing with a
 * photographer note saying what failed, as edits waiting for Commit.
 */
export function FlagList({ items, linkLabel }: FlagListProps) {
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const flag = useFlagPhotos();
  const toFlag = items.filter(
    (item) => !unticked.has(item.entry.key) && !alreadyFlagged(item.entry.photo.data, item.flag),
  );
  const toggle = (key: string) =>
    setUnticked((keys) => {
      const next = new Set(keys);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-xl border">
        {items.map((item) => (
          <FlagRow
            key={item.entry.key}
            item={item}
            ticked={!unticked.has(item.entry.key)}
            onToggle={() => toggle(item.entry.key)}
            linkLabel={linkLabel}
          />
        ))}
      </ul>
      <Button
        type="button"
        className="self-start"
        disabled={toFlag.length === 0}
        onClick={() => flag(toFlag)}
      >
        <RotateCcwIcon />
        {toFlag.length === 0
          ? "Every ticked photo is flagged"
          : `Flag ${count(toFlag.length, "photo")} for re-edit`}
      </Button>
      <p className="text-muted-foreground text-sm">
        Flagging marks each photo for re-edit and adds the note to its photographer notes, waiting
        for Commit.
      </p>
    </div>
  );
}

/** Marks photos for re-editing and adds their notes, as local edits that Commit saves. */
function useFlagPhotos() {
  const setField = useLocalEditsStore((s) => s.setField);
  return (items: FlagItem[]) => {
    const change = (item: FlagItem, value: unknown) => ({
      path: item.entry.photo.file.path,
      before: (item.entry.photo.file.data ?? {}) as Record<string, unknown>,
      value,
    });
    setField(
      RE_EDIT,
      items.map((item) => change(item, flaggedReEdit(item.entry.photo.data, item.flag))),
    );
    setField(
      NOTES,
      items.map((item) => change(item, flaggedNotes(item.entry.photo.data, item.flag))),
    );
  };
}

interface FlagRowProps {
  item: FlagItem;
  ticked: boolean;
  onToggle: () => void;
  linkLabel: string;
}

/** One failed photo: a tick box, its Small version uncropped, what failed, and its link. */
function FlagRow({ item, ticked, onToggle, linkLabel }: FlagRowProps) {
  const flagged = alreadyFlagged(item.entry.photo.data, item.flag);
  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-3 p-3 text-sm sm:grid-cols-[auto_auto_1fr_auto]">
      <input
        type="checkbox"
        aria-label={`Flag ${item.entry.key}`}
        className="accent-primary mt-1 size-4 shrink-0"
        checked={ticked || flagged}
        disabled={flagged}
        onChange={onToggle}
      />
      <FlagDetails item={item} flagged={flagged} />
      <PhotoLink entry={item.entry} label={linkLabel} />
    </li>
  );
}

/** The photo's Small version, its name, what failed, its re-edit flag and note. */
function FlagDetails({ item, flagged }: { item: FlagItem; flagged: boolean }) {
  const { entry, flag, detail } = item;
  const title = titleOf(entry.photo.data);
  return (
    <>
      <img
        src={entry.imageUrl}
        alt={title ?? entry.key}
        className="bg-muted h-16 w-auto max-w-28 rounded object-contain"
      />
      <div className="col-start-2 flex min-w-0 flex-col gap-1 sm:col-start-auto">
        <PhotoName name={entry.key} title={title} />
        <p>{detail}</p>
        <p className="text-muted-foreground">Re-edit: {flag.reason}</p>
        <p className="text-muted-foreground">Note: {flag.note}</p>
        {flagged && (
          <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckIcon className="size-4" /> Flagged for re-edit
          </p>
        )}
      </div>
    </>
  );
}

/** The photo's title and file name, or its file name alone when it has no title. */
function PhotoName({ name, title }: { name: string; title: string | undefined }) {
  if (!title) return <p className="font-medium break-words">{name}</p>;
  return (
    <p className="font-medium break-words">
      {title}
      <span className="text-muted-foreground font-normal"> · {name}</span>
    </p>
  );
}

/** Opens the photo on the Photo page's Image section, where faces are pixelated and images replaced. */
function PhotoLink({ entry, label }: { entry: AutogroupPhoto; label: string }) {
  const { photo } = entry;
  const search = photo.fromGallery
    ? { edit: photo.file.path, from: "gallery" as const, section: "image" as const }
    : { edit: photo.file.path, section: "image" as const };
  return (
    <Button
      variant="outline"
      size="sm"
      className="col-start-2 justify-self-start sm:col-start-auto"
      asChild
    >
      <Link to="/exif" search={search}>
        <ExternalLinkIcon />
        {label}
      </Link>
    </Button>
  );
}
