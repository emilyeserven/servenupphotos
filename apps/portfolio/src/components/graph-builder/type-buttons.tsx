import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ChoiceRow } from "@/components/choice-row";
import type { ConfigChange } from "@/components/graph-builder/graph-controls";
import { GRAPH_TYPES, graphTypeOf } from "@/components/graph-builder/graph-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GraphType } from "@/lib/graph-data";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";
import { cn } from "@/lib/utils";

/** What the type buttons need: the graph's type, and how to change it. */
interface TypeButtonsProps {
  type: GraphType;
  onChange: ConfigChange;
}

/**
 * The graph's type, changed in place from the graph's box: a joined row of the six types' icons
 * beside **Graph** / **Table**, the chosen one pressed and each named in a tooltip. On a phone the
 * row folds into one button showing the chosen type's icon, which opens the list of types. Both
 * write the same setting as Adjust Graph's **Graph type**.
 */
export function TypeButtons(props: TypeButtonsProps) {
  return (
    <>
      <TypeRow {...props} />
      <TypeMenu {...props} />
    </>
  );
}

/** The row of type icons, from a phone's width up. */
function TypeRow({ type, onChange }: TypeButtonsProps) {
  return (
    <div
      role="group"
      aria-label="Graph type"
      className={cn(CONTROL_FRAME, "hidden sm:inline-flex")}
    >
      {GRAPH_TYPES.map(([each, label, Icon]) => (
        <Tooltip key={each}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={label}
              aria-pressed={type === each}
              onClick={() => onChange({ type: each })}
              className={cn(controlButtonClass(type === each), "px-2")}
            >
              <Icon aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/** On a phone, one button with the chosen type's icon that opens the list of types. */
function TypeMenu({ type, onChange }: TypeButtonsProps) {
  const [open, setOpen] = useState(false);
  const [, name, Icon] = graphTypeOf(type);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn(CONTROL_FRAME, "sm:hidden")}>
        <PopoverTrigger
          aria-label={`Graph type: ${name}`}
          title="Change the graph type"
          className={cn(controlButtonClass(true), "gap-1 px-2")}
        >
          <Icon aria-hidden />
          <ChevronDown aria-hidden className="opacity-60" />
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="flex w-44 flex-col p-1">
        {GRAPH_TYPES.map(([each, label, EachIcon]) => (
          <ChoiceRow
            key={each}
            label={label}
            icon={<EachIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
            on={type === each}
            onClick={() => {
              onChange({ type: each });
              setOpen(false);
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
