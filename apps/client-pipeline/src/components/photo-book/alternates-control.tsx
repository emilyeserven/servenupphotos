import { CheckIcon, Layers2Icon } from "lucide-react";
import { unitName } from "@/components/photo-book/page-types";
import { SectionTitle } from "@/components/section-title";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type PhotoBook, isOtherPage } from "@/lib/photo-book";
import {
  alternatesLabel,
  alternatesOf,
  groupMembers,
  isHidden,
  leaveAlternates,
  markAlternate,
  pickAlternate,
  showAlternates,
} from "@/lib/photo-book-alternates";
import { type BookUnit, bookUnits } from "@/lib/photo-book-order";

interface AlternatesControlProps {
  unit: BookUnit;
  book: PhotoBook;
  update: (book: PhotoBook) => void;
}

/**
 * A page or spread's **Alternates** button: its group's letter when it's in one, and a flyout that
 * lists the group to pick one from (the others are hidden, not removed), shows them all again,
 * leaves the group, or makes another page or spread an alternate of this one.
 */
export function AlternatesControl({ unit, book, update }: AlternatesControlProps) {
  const group = alternatesOf(unit);
  const members = groupMembers(book, unit);
  const ids = new Set(members.map((u) => u.id));
  const others = bookUnits(book).filter(
    (u) => u.id !== unit.id && !ids.has(u.id) && !u.pages.some(isOtherPage),
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="xs"
          variant={group ? "secondary" : "ghost"}
          aria-label={`Alternates of ${unitName(unit)}`}
        >
          <Layers2Icon />
          {alternatesLabel(book, unit)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3 p-3">
        {group && (
          <GroupList
            members={members}
            current={unit}
            onPick={(id) => update(pickAlternate(book, id))}
            onShowAll={() => update(showAlternates(book, group))}
            onLeave={() => update(leaveAlternates(book, unit.id))}
          />
        )}
        <OthersList others={others} onMark={(id) => update(markAlternate(book, unit.id, id))} />
      </PopoverContent>
    </Popover>
  );
}

/** The group's pages and spreads, each to pick, then Show all again and Leave group. */
function GroupList(props: {
  members: BookUnit[];
  current: BookUnit;
  onPick: (id: string) => void;
  onShowAll: () => void;
  onLeave: () => void;
}) {
  const { members, current, onPick, onShowAll, onLeave } = props;
  const picked = members.some(isHidden);
  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle>This group</SectionTitle>
      <p className="text-muted-foreground text-xs">
        Pick the one to use: the others are hidden from Photo Pages and taken out of the book, but
        kept.
      </p>
      <ul className="flex flex-col">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate">
              {unitName(member)}
              {member.id === current.id && (
                <span className="text-muted-foreground"> (this one)</span>
              )}
            </span>
            <PickButton member={member} picked={picked} onPick={onPick} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1">
        {picked && (
          <Button size="xs" variant="outline" onClick={onShowAll}>
            Show all again
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={onLeave}>
          Leave group
        </Button>
      </div>
    </div>
  );
}

/** **Pick**, or **Picked** on the one shown once the group has a pick, or **Hidden** on the others. */
function PickButton(props: { member: BookUnit; picked: boolean; onPick: (id: string) => void }) {
  const { member, picked, onPick } = props;
  if (picked && !isHidden(member)) {
    return (
      <span className="flex items-center gap-0.5 font-medium">
        <CheckIcon className="size-3" />
        Picked
      </span>
    );
  }
  return (
    <Button size="xs" variant="outline" onClick={() => onPick(member.id)}>
      {picked ? "Hidden · pick" : "Pick"}
    </Button>
  );
}

/** The other photo pages and spreads, each to make an alternate of this one. */
function OthersList({ others, onMark }: { others: BookUnit[]; onMark: (id: string) => void }) {
  if (others.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle>Make an alternate of this one</SectionTitle>
      <ul className="flex max-h-48 flex-col overflow-y-auto">
        {others.map((other) => (
          <li key={other.id}>
            <button
              type="button"
              onClick={() => onMark(other.id)}
              className="hover:bg-accent w-full truncate rounded px-1 py-0.5 text-left text-xs"
            >
              + {unitName(other)}
              {alternatesOf(other) && (
                <span className="text-muted-foreground"> (and its group)</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
