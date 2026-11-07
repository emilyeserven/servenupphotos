import { ChevronsUpDown, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SectionPicker } from "@portfolio/components/section-picker";
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
  /** The chosen section's info pane, to the right of its controls, while its (i) is on; undefined while it's off. */
  aside?: (section: K) => ReactNode;
}

/**
 * A button of the Adjust Graph box, such as **Graph type**, **Axes** or **Range**, like the Grid's
 * **Gear & settings**: it opens a list of its sections on the left, each saying what it's set to,
 * and the chosen one's controls on the right (see `SectionPicker`).
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
        className="w-auto max-w-[calc(100vw-2rem)] p-0"
      >
        <PickerBody label={label} {...props} />
      </PopoverContent>
    </Popover>
  );
}

/** The chosen section's info pane, or undefined while there's none. */
function paneOf<K extends string>(
  aside: GraphPickerProps<K>["aside"],
  section: K,
): ReactNode | undefined {
  return aside ? aside(section) : undefined;
}

/** How wide the picker is beside phones: wider while it shows an info pane. */
function widthOf(pane: ReactNode | undefined): string {
  return pane === undefined ? "sm:w-[32rem]" : "sm:w-[48rem]";
}

/** The sections and the chosen section's controls beside them, or under them on phones. */
function PickerBody<K extends string>({
  label,
  sections,
  children,
  aside,
}: Omit<GraphPickerProps<K>, "Icon">) {
  const [chosen, setChosen] = useState<K | undefined>();
  const section = sections.find(([key]) => key === chosen)?.[0] ?? sections[0]![0];
  const pane = paneOf(aside, section);
  return (
    <SectionPicker
      label={label}
      sections={sections.map(([key, name, text]) => ({ key, label: name, text }))}
      chosen={section}
      onChoose={setChosen}
      width={widthOf(pane)}
      aside={pane}
    >
      <div className="-m-1 flex flex-col">{children(section)}</div>
    </SectionPicker>
  );
}
