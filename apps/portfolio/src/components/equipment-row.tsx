import type { ReactElement } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@portfolio/components/ui/tooltip";
import type { FilterOption } from "@portfolio/lib/filter-options";

/** What a hidden choice's hover says hides it, such as "Hidden by Aperture or Lens". */
function blockedText(blockedBy: string[]): string {
  if (blockedBy.length === 0) return "Hidden by the other filters together";
  return `Hidden by ${new Intl.ListFormat("en", { type: "disjunction" }).format(blockedBy)}`;
}

/**
 * One camera or lens choice, in the Script Display's writing. `blockedBy` names the filters hiding it,
 * when it's a hidden one: it's dimmed and its hover says so. `onPoint` hears when it's pointed at
 * or focused, for the info panel.
 */
export function EquipmentRow({
  option,
  on,
  blockedBy,
  onClick,
  onPoint,
}: {
  option: FilterOption;
  on: boolean;
  blockedBy?: string[];
  onClick: (on: boolean) => void;
  onPoint?: () => void;
}) {
  const { script } = useScriptDisplay();
  return (
    <div onMouseEnter={onPoint} onFocus={onPoint} className="flex flex-col">
      <BlockedHover blockedBy={blockedBy}>
        <ChoiceRow
          label={option.label[script]}
          count={option.count}
          depth={option.depth}
          on={on}
          dimmed={blockedBy !== undefined}
          onClick={() => onClick(on)}
        />
      </BlockedHover>
    </div>
  );
}

/** The row with a hover, to the right, saying what hides it; the row alone when it isn't hidden. */
function BlockedHover({ blockedBy, children }: { blockedBy?: string[]; children: ReactElement }) {
  if (!blockedBy) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-64 p-3 font-medium">
        {blockedText(blockedBy)}
      </TooltipContent>
    </Tooltip>
  );
}
