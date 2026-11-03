import { useId, useState } from "react";
import type { ActionProps } from "@/components/small-tags/small-tag-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SaveButton, count } from "@/components/update-data-shared";
import { type SmallTag, removalNote, removeChange, renameChange, tagId } from "@/lib/small-tags";

/**
 * Removes the tag from every photo and deletes its file, adding a photographer-only note to each
 * of its photos (prefilled, and left out when emptied). The tags under it go under its parent.
 */
export function RemoveTag({ small, pending, onSave }: ActionProps) {
  const [note, setNote] = useState(() => removalNote(small));
  const remove = () => {
    const { change, said } = removeChange(small, note);
    onSave(change, said);
  };
  return (
    <div className="flex flex-col gap-2 border-t pt-4 text-sm">
      {small.tagged.length > 0 && <NoteField small={small} note={note} onChange={setNote} />}
      <ChildrenMove small={small} />
      <SaveButton
        label={`Remove ${small.tag}`}
        pending={pending}
        disabled={false}
        error={null}
        onClick={remove}
      />
    </div>
  );
}

interface NoteFieldProps {
  small: SmallTag;
  note: string;
  onChange: (note: string) => void;
}

/** The photographer-only note a removed tag leaves on each of its photos. */
function NoteField({ small, note, onChange }: NoteFieldProps) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="font-medium">
        {small.tagged.length === 1
          ? "Photographer note on its photo"
          : `Photographer note on each of its ${count(small.tagged.length, "photo")}`}
      </label>
      <Textarea id={id} value={note} onChange={(e) => onChange(e.target.value)} />
      <p className="text-muted-foreground text-xs">
        Added after any notes they have. Only the pipeline shows it; empty it to add none.
      </p>
    </>
  );
}

/** Where the tags under a removed tag go: under its parent, or to the top level. */
function ChildrenMove({ small }: { small: SmallTag }) {
  if (small.children.length === 0) return null;
  const where = small.parent ? `under ${small.parent}` : "to the top level";
  return (
    <p className="text-muted-foreground text-xs">
      {small.children.join(", ")} will go {where}.
    </p>
  );
}

/**
 * Gives the tag a new ID, keeping its photos, description and the tags under it, or, when the ID
 * is another tag's, merges it into that tag: every photo with it gets that tag instead.
 */
export function RenameTag({ small, library, pending, onSave }: ActionProps) {
  const [typed, setTyped] = useState("");
  const to = tagId(typed);
  const others = library.tags.map((t) => t.tag).filter((t) => t !== small.tag);
  const merge = others.includes(to);
  const save = () => {
    const { change, said } = renameChange(small.tag, to, merge);
    onSave(change, said);
  };
  return (
    <div className="flex flex-col gap-2 border-t pt-4 text-sm">
      <TagIdField value={typed} tags={others} onChange={setTyped} />
      <RenameHint to={to} merge={merge} />
      <SaveButton
        label={merge ? `Merge into ${to}` : `Rename to ${to}`}
        pending={pending}
        disabled={to === "" || to === small.tag}
        error={null}
        onClick={save}
      />
    </div>
  );
}

/** What saving the typed ID does: merges into that tag when one has it, or else renames. */
function RenameHint({ to, merge }: { to: string; merge: boolean }) {
  return (
    <p className="text-muted-foreground text-xs">
      {merge
        ? `Its photos get ${to} instead, and the tags under it go under ${to}.`
        : "An ID no tag has renames it, keeping its photos, description and the tags under it."}
    </p>
  );
}

interface TagIdFieldProps {
  value: string;
  /** The other tags' IDs, suggested as they're typed. */
  tags: string[];
  onChange: (value: string) => void;
}

/** The new ID, or the tag to merge into, suggesting the other tags. */
function TagIdField({ value, tags, onChange }: TagIdFieldProps) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="font-medium">
        New ID, or the tag to merge it into
      </label>
      <Input
        id={id}
        list={`${id}-tags`}
        value={value}
        placeholder="such as street-lights"
        onChange={(e) => onChange(e.target.value)}
        className="max-w-sm font-mono"
      />
      <datalist id={`${id}-tags`}>
        {tags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </>
  );
}
