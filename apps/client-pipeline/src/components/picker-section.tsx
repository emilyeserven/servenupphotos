import { ChevronRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface PickerSectionProps {
  /** The section's name, such as "Suggested". */
  title: string;
  /** An icon shown before the title. */
  icon?: ReactNode;
  /** A line under the title saying what the photos are. */
  description: string;
  /** How many photos the section holds, shown next to the title. */
  count: number;
  /** Whether the section starts open. */
  defaultOpen: boolean;
  /** The section's photos; told whether the section is collapsed, so it can show only a peek. */
  children: (collapsed: boolean) => ReactNode;
}

/**
 * A titled group of photos in the calendar's photo picker that its heading opens and collapses.
 * Collapsed, it shows whatever children render for a collapsed section, which can be nothing.
 */
export function PickerSection(props: PickerSectionProps) {
  const { title, icon, description, count, defaultOpen, children } = props;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="flex flex-col gap-2" aria-label={`${title} photos`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="hover:bg-muted/50 focus-visible:ring-ring -mx-1 flex flex-col items-start rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-2"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <ChevronRightIcon
            className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-90")}
            aria-hidden
          />
          {icon}
          {title}
          <span className="text-muted-foreground font-normal">{count.toLocaleString()}</span>
        </span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </button>
      {children(!open)}
    </section>
  );
}

/**
 * The classes that keep a photo in a collapsed section's peek to the first row of the picker's
 * grid: 3 photos wide on a phone, 4 from the sm breakpoint.
 */
export function peekClass(collapsed: boolean, index: number): string | undefined {
  if (!collapsed) return undefined;
  if (index >= 4) return "hidden";
  return index === 3 ? "max-sm:hidden" : undefined;
}
