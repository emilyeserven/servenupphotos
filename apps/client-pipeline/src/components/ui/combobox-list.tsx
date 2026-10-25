import { CheckIcon } from "lucide-react";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import type { ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

interface ComboboxListProps {
  /** The field the list opens under and is as wide as. */
  children: ReactNode;
  open: boolean;
  listId: string;
  /** The options shown, already filtered by what's typed. */
  shown: ComboboxOption[];
  activeIndex: number;
  optionId: (index: number) => string;
  isSelected: (option: ComboboxOption) => boolean;
  onActive: (index: number) => void;
  onChoose: (option: ComboboxOption) => void;
  /** Shown in the list when nothing matches what's typed. */
  emptyText: string;
  multiple?: boolean;
}

/**
 * A combobox's list of options, drawn over the rest of the page rather than inside its field's
 * container, so a card or a scrolling panel doesn't cut it off. It opens below the field, or above
 * it when there's no room below, and focus stays in the field's text box.
 */
export function ComboboxList({ children, open, ...list }: ComboboxListProps) {
  return (
    <Popover.Root open={open}>
      <Popover.Anchor asChild>{children}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          asChild
          align="start"
          sideOffset={4}
          // The text box keeps focus while the list is open, and when it closes.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <OptionList {...list} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type OptionListProps = Omit<ComboboxListProps, "children" | "open">;

function OptionList({
  listId,
  shown,
  activeIndex,
  optionId,
  isSelected,
  onActive,
  onChoose,
  emptyText,
  multiple,
  ...popover
}: OptionListProps) {
  return (
    <ul
      {...popover}
      id={listId}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      className="bg-popover text-popover-foreground ring-foreground/10 z-50 max-h-[min(16rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) overflow-y-auto rounded-lg p-1 shadow-md ring-1"
    >
      {shown.length === 0 ? (
        <li className="text-muted-foreground px-2 py-1 text-xs/relaxed">{emptyText}</li>
      ) : (
        shown.map((option, index) => (
          <li
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={isSelected(option)}
            className={cn(
              "flex min-h-7 cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs/relaxed",
              index === activeIndex && "bg-accent text-accent-foreground",
            )}
            // Keeps focus in the text box, so the list stays open for another choice.
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => onActive(index)}
            onClick={() => onChoose(option)}
          >
            <CheckIcon
              className={cn("mt-1 size-3.5 shrink-0", !isSelected(option) && "invisible")}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block truncate">{option.label}</span>
              {option.detail && (
                <span className="text-muted-foreground block truncate text-xs">
                  {option.detail}
                </span>
              )}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
