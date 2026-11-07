import { ChevronDown, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { SectionTab } from "@portfolio/components/picker-section-tab";
import { FilterCount } from "@portfolio/components/filter-count";
import { InfoButton } from "@portfolio/components/info-button";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import { cn } from "@portfolio/lib/utils";

/** One section in a picker's left list, such as Cameras or Seasons. */
export interface PickerSection<K extends string = string> {
  key: K;
  /** Its name in the list, such as "Cameras". */
  label: string;
  /** What it's set to, shown under its name, such as "X-T5" or "Any". */
  text: string;
  /** Whether it has a filter set, which shows a dot after its name. */
  set?: boolean;
  Icon?: LucideIcon;
}

/** What a section picker shows: its sections, the chosen one, and that one's controls. */
interface SectionPickerProps<K extends string> {
  /** The list's name for screen readers, such as "Gear and settings". */
  label: string;
  sections: PickerSection<K>[];
  chosen: K;
  onChoose: (key: K) => void;
  /** The picker's width beside phones, such as "sm:w-[34rem]". */
  width: string;
  /** Under the list, such as a Clear button. */
  footer?: ReactNode;
  /** The chosen section's controls. */
  children: ReactNode;
}

/**
 * The insides of every filter picker, such as **When**, **Groups**, **Gear & settings** and
 * **Visuals**: a list of sections on the left, each saying what it's set to, and the chosen
 * section's controls on the right. On phones the list folds up above the controls instead, behind
 * a button naming the chosen section, and takes the controls' place while it's open; choosing a
 * section folds it up again.
 */
export function SectionPicker<K extends string>(props: SectionPickerProps<K>) {
  const [listOpen, setListOpen] = useState(false);
  const current = props.sections.find((section) => section.key === props.chosen);
  const choose = (key: K) => {
    props.onChoose(key);
    setListOpen(false);
  };
  return (
    <div
      className={cn(
        "flex max-h-[min(28rem,calc(var(--radix-popover-content-available-height)-1rem))] w-[calc(100vw-2rem)] flex-col sm:flex-row",
        props.width,
      )}
    >
      <ListToggle section={current} open={listOpen} onClick={() => setListOpen(!listOpen)} />
      <SectionList {...props} listOpen={listOpen} onChoose={choose} />
      <div
        role="tabpanel"
        aria-label={current?.label}
        className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto p-3", listOpen && "max-sm:hidden")}
      >
        {props.children}
      </div>
    </div>
  );
}

/** The list of sections, with the footer under it; on phones, only while it's open. */
function SectionList<K extends string>({
  label,
  sections,
  chosen,
  onChoose,
  footer,
  listOpen,
}: SectionPickerProps<K> & { listOpen: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-0.5 overflow-y-auto border-b bg-muted/40 p-1 sm:w-40 sm:shrink-0 sm:border-r sm:border-b-0",
        !listOpen && "max-sm:hidden",
      )}
    >
      <div role="tablist" aria-orientation="vertical" aria-label={label}>
        {sections.map(({ key, ...section }) => (
          <SectionTab
            key={key}
            {...section}
            chosen={chosen === key}
            onClick={() => onChoose(key)}
          />
        ))}
      </div>
      {footer}
    </div>
  );
}

/**
 * On phones only, the button that opens and closes the list of sections, naming the chosen one
 * and what it's set to.
 */
function ListToggle({
  section,
  open,
  onClick,
}: {
  section: PickerSection | undefined;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:hidden"
    >
      <span className="font-medium whitespace-nowrap">{section?.label}</span>
      <span className="truncate text-xs text-muted-foreground">{section?.text}</span>
      <ChevronDown
        aria-hidden
        className={cn("ml-auto size-4 shrink-0 transition-transform", open && "rotate-180")}
      />
    </button>
  );
}

/**
 * A filter's button that opens its picker, such as **When**: its icon and name, `badge` (such as
 * the picked color), how many of its filters are set, and the picker under it, 16px from the
 * screen's edges.
 */
export function FilterPickerButton({
  Icon,
  label,
  count,
  badge,
  children,
}: {
  Icon: LucideIcon;
  label: string;
  count: number;
  badge?: ReactNode;
  /** The picker, usually a `SectionPicker`. */
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <Icon className="text-muted-foreground" aria-hidden />
          {label}
          {badge}
          <FilterCount count={count} />
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-auto max-w-[calc(100vw-2rem)] p-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A section's controls, with a line over them saying what they're for. With `info`, an (i) button
 * beside that line shows or hides it under the controls, such as what each choice does.
 */
export function PickerPart({
  intro,
  info,
  children,
}: {
  intro: string;
  info?: ReactNode;
  children: ReactNode;
}) {
  if (info === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{intro}</p>
        {children}
      </div>
    );
  }
  return (
    <InfoPart intro={intro} info={info}>
      {children}
    </InfoPart>
  );
}

/** A section's controls with an (i) button beside its line, showing `info` under them while on. */
function InfoPart({
  intro,
  info,
  children,
}: {
  intro: string;
  info: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="-mt-1 -mr-1 flex items-start gap-2">
        <p className="flex-1 pt-1 text-xs text-muted-foreground">{intro}</p>
        <InfoButton open={open} label="what each choice does" onClick={() => setOpen(!open)} />
      </div>
      {children}
      {open && info}
    </div>
  );
}

/** An X under a picker's list clearing all its filters, such as **Clear visuals**. */
export function PickerClear({
  text,
  label,
  onClear,
}: {
  /** What it says, such as "Clear visuals". */
  text: string;
  /** The filter's name for screen readers, such as "Visuals". */
  label: string;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground sm:mt-auto">
      {text}
      <ClearFilterButton label={label} onClear={onClear} />
    </div>
  );
}
