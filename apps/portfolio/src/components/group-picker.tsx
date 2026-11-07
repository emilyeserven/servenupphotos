import { ChevronDown, ChevronsUpDown, FolderOpen } from "lucide-react";
import { useState } from "react";
import {
  type GroupPickerProps,
  type GroupSection,
  GroupPickerPart,
  useSections,
} from "@portfolio/components/group-picker-parts";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import { cn } from "@portfolio/lib/utils";

/**
 * A **Groups** button that opens one picker for the album, tag and genre filters, like **When**: a
 * list of Albums, Tags and Genres on the left, each saying what it's set to, and the chosen one's
 * choices on the right. One of each can be chosen at once. Tags and Genres are left out while there
 * are none. On phones the list folds up above the choices, under a button naming the chosen one.
 */
export function GroupPicker(props: GroupPickerProps) {
  const sections = useSections(props);
  const count = sections.filter((section) => section.chosen).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <FolderOpen className="text-muted-foreground" aria-hidden />
          Groups
          {count > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {count}
            </span>
          )}
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[min(30rem,calc(100vw-2rem))] p-0"
      >
        <PickerBody sections={sections} {...props} />
      </PopoverContent>
    </Popover>
  );
}

/** The first section with a choice made, or the albums when none has one. */
function firstChosen(sections: GroupSection[]): GroupSection["key"] {
  return sections.find((section) => section.chosen)?.key ?? "album";
}

/** The list of sections and the chosen section's choices beside it, or under it on phones. */
function PickerBody({ sections, ...props }: GroupPickerProps & { sections: GroupSection[] }) {
  const [key, setKey] = useState(() => firstChosen(sections));
  const [listOpen, setListOpen] = useState(false);
  const section = sections.find((each) => each.key === key) ?? sections[0];
  if (!section) return null;
  const choose = (next: GroupSection["key"]) => {
    setKey(next);
    setListOpen(false);
  };
  return (
    <div className="flex max-h-[min(28rem,var(--radix-popover-content-available-height))] flex-col sm:flex-row">
      <ListToggle section={section} open={listOpen} onClick={() => setListOpen(!listOpen)} />
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Group filters"
        className={cn(
          "flex shrink-0 flex-col gap-0.5 border-b bg-muted/40 p-1 sm:flex sm:w-40 sm:border-r sm:border-b-0",
          !listOpen && "max-sm:hidden",
        )}
      >
        {sections.map((each) => (
          <SectionTab
            key={each.key}
            section={each}
            chosen={each.key === key}
            onClick={() => choose(each.key)}
          />
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto p-2">
        <GroupPickerPart key={key} section={section} {...props} />
      </div>
    </div>
  );
}

/** On phones, a button naming the section shown, which folds the list of sections open or shut. */
function ListToggle({
  section,
  open,
  onClick,
}: {
  section: GroupSection;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="flex items-center gap-2 border-b px-3 py-2 text-left text-sm font-medium outline-none hover:bg-accent focus-visible:bg-accent sm:hidden"
    >
      {section.label}
      <span className="truncate text-xs font-normal text-muted-foreground">
        {section.chosenText ?? "Any"}
      </span>
      <ChevronDown
        aria-hidden
        className={cn(
          "ml-auto size-4 shrink-0 opacity-50 transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

/** A section in the left list: its name, with what it's set to under it and a dot while it's set. */
function SectionTab({
  section,
  chosen,
  onClick,
}: {
  section: GroupSection;
  chosen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={chosen}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        chosen && "bg-background shadow-xs",
      )}
    >
      <span className="flex w-full items-center gap-1.5 font-medium">
        <section.Icon className="size-4 text-muted-foreground" aria-hidden />
        {section.label}
        {section.chosen && (
          <span className="ml-auto size-1.5 rounded-full bg-primary" aria-label="(set)" />
        )}
      </span>
      <span className="w-full truncate text-xs text-muted-foreground">
        {section.chosenText ?? "Any"}
      </span>
    </button>
  );
}
