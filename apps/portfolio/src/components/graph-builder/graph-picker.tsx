import { ChevronsUpDown, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SectionTab } from "@portfolio/components/picker-section-tab";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";

/** One section of a graph settings picker: its key, its name, and what it's set to. */
export type GraphPickerSection<K extends string> = [key: K, label: string, text: string];

interface GraphPickerProps<K extends string> {
  /** The button's name, such as "Axes". */
  label: string;
  Icon: LucideIcon;
  sections: GraphPickerSection<K>[];
  /** The chosen section's controls. */
  children: (section: K) => ReactNode;
}

/**
 * A button of the Adjust Graph box, such as **Graph type**, **Axes** or **Range**, like the Grid's
 * **Gear & settings**: it opens a list of its sections on the left, each saying what it's set to,
 * and the chosen one's controls on the right.
 */
export function GraphPicker<K extends string>({ label, Icon, ...props }: GraphPickerProps<K>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <Icon className="text-muted-foreground" aria-hidden />
          {label}
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[min(32rem,calc(100vw-2rem))] p-0"
      >
        <PickerBody label={label} {...props} />
      </PopoverContent>
    </Popover>
  );
}

/** The list of sections and the chosen section's controls beside it, or under it on phones. */
function PickerBody<K extends string>({
  label,
  sections,
  children,
}: Omit<GraphPickerProps<K>, "Icon">) {
  const [chosen, setChosen] = useState<K | undefined>();
  const section = sections.find(([key]) => key === chosen)?.[0] ?? sections[0]![0];
  return (
    <div className="flex max-h-[min(28rem,calc(var(--radix-popover-content-available-height)-1rem))] flex-col sm:flex-row">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label={label}
        className="flex shrink-0 flex-col gap-0.5 overflow-y-auto border-b bg-muted/40 p-1 sm:w-40 sm:border-r sm:border-b-0"
      >
        {sections.map(([key, name, text]) => (
          <SectionTab
            key={key}
            label={name}
            text={text}
            chosen={section === key}
            onClick={() => setChosen(key)}
          />
        ))}
      </div>
      <div role="tabpanel" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2">
        {children(section)}
      </div>
    </div>
  );
}
