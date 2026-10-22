import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { optimisticEntry, type Place, savePlaceMutation } from "@/api/places";
import { FieldLabel } from "@/components/field-label";
import { PlaceCityField } from "@/components/place-city-field";
import { Button } from "@/components/ui/button";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { Spinner } from "@/components/ui/spinner";
import { type BulkChange, bulkChanged, bulkNotParents, parentOptions } from "@/lib/place-bulk";

interface PlaceBulkBarProps {
  /** The places checked in the list. */
  selected: Place[];
  /** Every place, to choose a parent from. */
  places: Place[];
  /** Unchecks every place, once the changes are saved or to give up. */
  onClear: () => void;
}

const NO_CHANGE: BulkChange = { city: "", parent: "" };

/** The count with its noun, such as "1 place" or "3 places". */
function placesText(count: number): string {
  return `${count} place${count === 1 ? "" : "s"}`;
}

/** Saves each changed place as its own queued commit; says how many failed and why. */
function useBulkSave(onDone: () => void) {
  const queryClient = useQueryClient();
  const save = useMutation({ ...savePlaceMutation, ...optimisticEntry(queryClient, "places") });
  // How many places are being saved; 0 when none are.
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState("");
  const run = async (changed: Place[]) => {
    setSaving(changed.length);
    setError("");
    const results = await Promise.allSettled(changed.map((place) => save.mutateAsync(place)));
    setSaving(0);
    const failed = results.flatMap((r) => (r.status === "rejected" ? [r.reason as Error] : []));
    if (failed.length === 0) return onDone();
    setError(`${placesText(failed.length)} didn't save: ${failed[0]?.message}`);
  };
  return { run, saving, running: saving > 0, error };
}

type BulkSave = ReturnType<typeof useBulkSave>;

/**
 * Shown while places are checked in the list: a city and a place to put them all in, and a button
 * that saves every place it changes. Places in a checked place can't be chosen as the parent.
 */
export function PlaceBulkBar({ selected, places, onClear }: PlaceBulkBarProps) {
  const [change, setChange] = useState<BulkChange>(NO_CHANGE);
  const bulk = useBulkSave(() => {
    setChange(NO_CHANGE);
    onClear();
  });
  const changed = bulkChanged(selected, change);
  return (
    <section
      aria-label="Change the checked places"
      className="bg-muted/40 flex flex-col gap-3 rounded-md border p-3"
    >
      <BulkHeader count={selected.length} disabled={bulk.running} onClear={onClear} />
      <div className="grid gap-3 sm:grid-cols-2">
        <PlaceCityField
          id="bulk-city"
          value={change.city}
          places={places}
          disabled={bulk.running}
          help="Sets this city on every checked place, and its country when it's known. Leave it empty to keep each place's own."
          onChange={(city, country) => setChange((c) => ({ ...c, city, country }))}
        />
        <BulkParentField
          selected={selected}
          places={places}
          value={change.parent}
          disabled={bulk.running}
          onChange={(parent) => setChange((c) => ({ ...c, parent }))}
        />
      </div>
      {bulk.error && <p className="text-destructive text-sm">{bulk.error}</p>}
      <BulkSaveButton bulk={bulk} changed={changed} />
    </section>
  );
}

interface BulkHeaderProps {
  count: number;
  disabled: boolean;
  onClear: () => void;
}

/** How many places are checked, and a button to uncheck them. */
function BulkHeader({ count, disabled, onClear }: BulkHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-medium">{placesText(count)} checked</span>
      <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
        Uncheck all
      </Button>
    </div>
  );
}

/** Saves the places the change would change, saying how many, or how many are saving. */
function BulkSaveButton({ bulk, changed }: { bulk: BulkSave; changed: Place[] }) {
  const label = bulk.running
    ? `Saving ${placesText(bulk.saving)}…`
    : `Save ${placesText(changed.length)}`;
  return (
    <div>
      <Button
        type="button"
        disabled={changed.length === 0 || bulk.running}
        onClick={() => void bulk.run(changed)}
      >
        {bulk.running && <Spinner />}
        {label}
      </Button>
    </div>
  );
}

interface BulkParentFieldProps {
  selected: Place[];
  places: Place[];
  value: string;
  disabled: boolean;
  onChange: (parent: string) => void;
}

/** The place to put every checked place in; the checked places and places in them aren't offered. */
function BulkParentField({ selected, places, value, disabled, onChange }: BulkParentFieldProps) {
  const options = parentOptions(places, bulkNotParents(places, selected));
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel
        id="bulk-parent-label"
        help="Puts every checked place in this place. Places that are checked, or in a checked place, can't be chosen. Leave it empty to keep each place's own."
      >
        In
      </FieldLabel>
      <SingleCombobox
        id="bulk-parent"
        aria-labelledby="bulk-parent-label"
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        emptyText="No place they can all go in."
      />
    </div>
  );
}
