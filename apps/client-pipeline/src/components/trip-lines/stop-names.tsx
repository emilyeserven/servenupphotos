import { Languages } from "lucide-react";
import { useId, useState } from "react";
import type { Localization } from "@/api/places";
import type { TripVisit } from "@/api/trip-lines";
import { FieldLabel } from "@/components/field-label";
import { LOCALIZATION_HELP } from "@/components/localization-fields";
import { FIELDS } from "@/components/localization-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentLists } from "@/lib/group-photos";
import { hasStopNames } from "@/lib/trip-visits";
import { useCombinedData } from "@/stores/combined-data";

/** The saved localization of the place with the ID, from the combined lists; none for no place. */
function usePlaceLocalization(place: string | undefined): Localization | undefined {
  const data = useCombinedData().data;
  if (!data || !place) return undefined;
  const all = (currentLists(data).localizations.data ?? []) as Localization[];
  return all.find((l) => l.id === `place-${place}`);
}

interface StopNamesProps {
  visit: TripVisit;
  onChange: (visit: TripVisit) => void;
}

/**
 * A trip stop's localized names: its romanization, local pronunciation and local script, as a saved
 * place's localization has them. A button in the stop's row opens them under it, open from the start
 * when any is written. On a stop picked from a saved place, each empty one shows the place's as a
 * placeholder, which the portfolio uses for it.
 */
export function StopNames({ visit, onChange }: StopNamesProps) {
  const [open, setOpen] = useState(() => hasStopNames(visit));
  const fromPlace = usePlaceLocalization(visit.place);
  const idPrefix = useId();
  return (
    <>
      <Button
        variant={open ? "secondary" : "ghost"}
        size="icon"
        className="size-8"
        title="Localized names: its name in Latin letters, as said locally and in its own script"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Languages className="size-4" aria-hidden />
        <span className="sr-only">Localized names</span>
      </Button>
      {open && (
        <fieldset className="grid basis-full gap-3 sm:grid-cols-3">
          <legend className="sr-only">Localized names</legend>
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <FieldLabel htmlFor={`${idPrefix}-${key}`} help={LOCALIZATION_HELP[key]}>
                {label}
              </FieldLabel>
              <Input
                id={`${idPrefix}-${key}`}
                className="h-8"
                placeholder={fromPlace?.[key] || undefined}
                value={visit[key] ?? ""}
                onChange={(e) => onChange({ ...visit, [key]: e.target.value })}
              />
            </div>
          ))}
          {fromPlace && (
            <p className="text-muted-foreground text-xs sm:col-span-3">
              Left empty, each uses the saved place's localization, shown faintly.
            </p>
          )}
        </fieldset>
      )}
    </>
  );
}
