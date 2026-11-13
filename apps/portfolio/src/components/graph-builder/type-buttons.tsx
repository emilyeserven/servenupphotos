import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ChoiceRow } from "@/components/choice-row";
import type { ConfigChange } from "@/components/graph-builder/graph-controls";
import { GRAPH_TYPES, graphTypeOf } from "@/components/graph-builder/graph-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GraphType } from "@/lib/graph-data";
import { suggestedType, type TypeFit } from "@/lib/graph-suggest";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";
import { cn } from "@/lib/utils";

/** What the type buttons need: the graph's type, how to change it, and each type's fit for the axes. */
interface TypeButtonsProps {
  type: GraphType;
  onChange: ConfigChange;
  /** Each type's fit for what's on the axes, as the Graph type picker marks them (`useTypeFits`). */
  fits: Record<GraphType, TypeFit>;
}

/**
 * A type's name with its fit, for a button's tooltip and the name a screen reader hears: "Line,
 * suggested" for the suggested type, "Pie, a poor fit: slices lose the order…" for a poor one, and
 * just the name otherwise.
 */
function fitName(label: string, fit: TypeFit, suggested: boolean): string {
  if (suggested) return `${label}, suggested`;
  if (fit.fit !== "poor") return label;
  return `${label}, a poor fit: ${fit.reason.charAt(0).toLowerCase()}${fit.reason.slice(1)}`;
}

/** How dim a type's button is: a poor fit is faded while it isn't the chosen type, but still pickable. */
function dimClass(fit: TypeFit, on: boolean): string | undefined {
  return fit.fit === "poor" && !on ? "opacity-50 hover:opacity-100" : undefined;
}

/**
 * The graph's type, changed in place from the graph's box: a joined row of the six types' icons
 * beside **Graph** / **Table**, the chosen one pressed and each named in a tooltip. On a phone the
 * row folds into one button showing the chosen type's icon, which opens the list of types. Both
 * write the same setting as Adjust Graph's **Graph type**, and mark the types the same way: a poor
 * fit for the axes dimmed, and each tooltip saying when a type is suggested or a poor fit.
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
function TypeRow({ type, onChange, fits }: TypeButtonsProps) {
  const suggested = suggestedType(fits);
  return (
    <div
      role="group"
      aria-label="Graph type"
      className={cn(CONTROL_FRAME, "hidden sm:inline-flex")}
    >
      {GRAPH_TYPES.map(([each, label, Icon]) => {
        const name = fitName(label, fits[each], each === suggested);
        return (
          <Tooltip key={each}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={name}
                aria-pressed={type === each}
                onClick={() => onChange({ type: each })}
                className={cn(
                  controlButtonClass(type === each),
                  "px-2",
                  dimClass(fits[each], type === each),
                )}
              >
                <Icon aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{name}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** On a phone, one button with the chosen type's icon that opens the list of types. */
function TypeMenu({ type, onChange, fits }: TypeButtonsProps) {
  const [open, setOpen] = useState(false);
  const suggested = suggestedType(fits);
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
      <PopoverContent align="end" className="flex w-52 flex-col p-1">
        {GRAPH_TYPES.map(([each, label, EachIcon]) => (
          <ChoiceRow
            key={each}
            label={label}
            icon={<EachIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
            tag={each === suggested ? "Suggested" : undefined}
            dimmed={fits[each].fit === "poor"}
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
