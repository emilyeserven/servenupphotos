import { ChevronsUpDown, MapPin } from "lucide-react";
import { PlacesPanel } from "@portfolio/components/place-columns";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverTrigger } from "@portfolio/components/ui/popover";
import type { LocationOption } from "@portfolio/lib/filter-options";
import { NO_STATE } from "@portfolio/lib/photo-filters";
import type { ScriptDisplay } from "@portfolio/lib/localize";
import { everyOption, valueOf } from "@portfolio/lib/place-tree";
import { cn } from "@portfolio/lib/utils";

/** What the button says: "All places", the one place's name, or how many are chosen. */
function buttonText(options: LocationOption[], selected: string[], script: ScriptDisplay): string {
  if (selected.length === 0) return "All places";
  if (selected.length > 1) return `${selected.length} places`;
  return oneText(options, selected[0]!, script);
}

/** What the button says for one chosen place: its name, "No region" for photos without one, or "1 place". */
function oneText(options: LocationOption[], selected: string, script: ScriptDisplay): string {
  if (selected === `state:${NO_STATE}`) return "No region";
  const chosen = everyOption(options).find((option) => valueOf(option) === selected);
  return chosen ? chosen.label[script] : "1 place";
}

/**
 * The **Places** filter: a button opening every country, region, city and place the photos were
 * taken in as side-by-side columns (see `PlacesPanel`), with a checkbox for each, so any number can
 * be chosen, in any countries. `selected` holds the chosen ones' values, such as "city:Seoul".
 */
export function PlacesFilter({
  options,
  selected,
  onChange,
}: {
  options: LocationOption[];
  selected: string[];
  onChange: (selection: string[]) => void;
}) {
  const { script } = useScriptDisplay();
  const text = buttonText(options, selected, script);

  /** Chooses the place, or unchooses it when it's chosen. */
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((chosen) => chosen !== value)
        : [...selected, value],
    );
  }

  return (
    <Popover>
      {/* The X sits over the button, inside its border, as a button can't hold another. */}
      <div className="relative inline-flex max-w-56 items-center">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-label={`Places: ${text}`}
            className={cn(
              "w-full font-normal has-[>svg]:pr-8",
              selected.length > 0 && "has-[>svg]:pr-14",
            )}
          >
            <MapPin aria-hidden className="text-muted-foreground" />
            <span className="truncate">{text}</span>
          </Button>
        </PopoverTrigger>
        {selected.length > 0 && (
          <ClearFilterButton
            label="Places"
            onClear={() => onChange([])}
            className="absolute right-7"
          />
        )}
        <ChevronsUpDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 size-4 opacity-50"
        />
      </div>
      <PlacesPanel
        options={options}
        selected={selected}
        onChoose={toggle}
        onClear={() => onChange([])}
      />
    </Popover>
  );
}
