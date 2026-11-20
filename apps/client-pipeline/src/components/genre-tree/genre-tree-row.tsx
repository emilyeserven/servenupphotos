import {
  ArrowDownIcon,
  ArrowUpIcon,
  CornerDownRightIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
} from "lucide-react";
import type { GenreTreeEntry } from "@/api/organize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  canMoveGenre,
  genreAbove,
  genreDescendants,
  moveGenre,
  moveGenreUnder,
  outdentGenre,
  renameGenre,
} from "@/lib/genre-tree";

interface GenreTreeRowProps {
  entry: GenreTreeEntry;
  /** How many levels down it sits: 0 for a top-level genre. */
  depth: number;
  /** Every genre in the draft, in order, which each change starts from. */
  draft: GenreTreeEntry[];
  /** How many photos list the genre; undefined until ALLPHOTOS.json is read. */
  count?: number;
  disabled: boolean;
  onChange: (draft: GenreTreeEntry[]) => void;
}

/**
 * One genre on Reorganize Genres: its name to edit, the genre it's under, its photo count, and
 * buttons that move it among its siblings or a level in or out. Every change stays in the draft
 * until Save.
 */
export function GenreTreeRow({
  entry,
  depth,
  draft,
  count,
  disabled,
  onChange,
}: GenreTreeRowProps) {
  const label = entry.name.trim() || entry.id;
  return (
    <TableRow>
      <TableCell className="min-w-56">
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 1.5}rem` }}>
          {depth > 0 && (
            <CornerDownRightIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Input
              value={entry.name}
              aria-label={`Name of the genre ${entry.id}`}
              disabled={disabled}
              className="h-8"
              onChange={(event) => onChange(renameGenre(draft, entry.id, event.target.value))}
            />
            <code className="text-muted-foreground text-[0.7rem]">{entry.id}</code>
          </div>
        </div>
      </TableCell>
      <TableCell className="min-w-48">
        <ParentPicker entry={entry} draft={draft} disabled={disabled} onChange={onChange} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{count ?? "…"}</TableCell>
      <TableCell>
        <MoveButtons
          entry={entry}
          label={label}
          draft={draft}
          disabled={disabled}
          onChange={onChange}
        />
      </TableCell>
    </TableRow>
  );
}

type PartProps = Pick<GenreTreeRowProps, "entry" | "draft" | "disabled" | "onChange">;

/** Picks the genre this one is a subgenre of, leaving out itself and the genres under it. */
function ParentPicker({ entry, draft, disabled, onChange }: PartProps) {
  const under = genreDescendants(draft, entry.id);
  const options = draft
    .filter((other) => other.id !== entry.id && !under.has(other.id))
    .map((other) => ({ value: other.id, label: other.name.trim() || other.id }));
  return (
    <SingleCombobox
      options={options}
      value={entry.parent}
      disabled={disabled}
      placeholder="Top level"
      emptyText="No genre matches."
      aria-labelledby="genre-tree-under"
      onChange={(parent) => onChange(moveGenreUnder(draft, entry.id, parent))}
    />
  );
}

/** Moves the genre up or down among its siblings, out of its parent, or under the genre above it. */
function MoveButtons({ entry, label, draft, disabled, onChange }: PartProps & { label: string }) {
  const above = genreAbove(draft, entry.id);
  const moves = [
    {
      key: "up",
      text: `Move ${label} up`,
      Icon: ArrowUpIcon,
      can: canMoveGenre(draft, entry.id, -1),
      next: () => moveGenre(draft, entry.id, -1),
    },
    {
      key: "down",
      text: `Move ${label} down`,
      Icon: ArrowDownIcon,
      can: canMoveGenre(draft, entry.id, 1),
      next: () => moveGenre(draft, entry.id, 1),
    },
    {
      key: "out",
      text: `Move ${label} out of its parent genre`,
      Icon: IndentDecreaseIcon,
      can: entry.parent !== "",
      next: () => outdentGenre(draft, entry.id),
    },
    {
      key: "in",
      text: `Make ${label} a subgenre of ${above ? above.name.trim() || above.id : "the genre above it"}`,
      Icon: IndentIncreaseIcon,
      can: Boolean(above),
      next: () => (above ? moveGenreUnder(draft, entry.id, above.id) : draft),
    },
  ];
  return (
    <span className="flex justify-end gap-0.5">
      {moves.map(({ key, text, Icon, can, next }) => (
        <Button
          key={key}
          size="icon-xs"
          variant="ghost"
          aria-label={text}
          title={text}
          disabled={disabled || !can}
          onClick={() => onChange(next())}
        >
          <Icon aria-hidden />
        </Button>
      ))}
    </span>
  );
}
