import { Link } from "@tanstack/react-router";
import type { Place } from "@/api/places";
import { FieldLabel } from "@/components/field-label";
import { JOIN_WORDS, childJoin, joinLabel } from "@/lib/place-joins";
import { cn } from "@/lib/utils";

const SELECT = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] disabled:opacity-50",
);

interface JoinSelectProps {
  id: string;
  label: string;
  help: string;
  value: string;
  /** What "" means, such as "in". */
  fallback: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** A connecting word, or "" for the default it names. */
function JoinSelect({ id, label, help, value, fallback, disabled, onChange }: JoinSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} help={help}>
        {label}
      </FieldLabel>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT}
      >
        <option value="">Default ({joinLabel(fallback)})</option>
        {JOIN_WORDS.map((word) => (
          <option key={word} value={word}>
            {joinLabel(word)}
          </option>
        ))}
      </select>
    </div>
  );
}

interface PlaceJoinFieldsProps {
  /** The place it's in, if any. */
  parent: Place | undefined;
  name: string;
  parentRelation: string;
  childRelation: string;
  disabled: boolean;
  onChange: (field: "parentRelation" | "childRelation", value: string) => void;
}

/**
 * The words a photo's places are joined with when one is in the other: this place's word before
 * the place it's in, and the default word for the places in this one.
 */
export function PlaceJoinFields({
  parent,
  name,
  parentRelation,
  childRelation,
  disabled,
  onChange,
}: PlaceJoinFieldsProps) {
  const self = name.trim() || "this place";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {parent && (
        <JoinSelect
          id="place-parent-relation"
          label={`Word before ${parent.name}`}
          help={`How a photo given both reads, such as “In ${self} in ${parent.name}”, or with a comma, “In ${self}, ${parent.name}”. Default is ${parent.name}'s word for the places in it.`}
          value={parentRelation}
          fallback={childJoin(parent)}
          disabled={disabled}
          onChange={(value) => onChange("parentRelation", value)}
        />
      )}
      <JoinSelect
        id="place-child-relation"
        label="Word for places in it"
        help={`The word between a place in ${self} and ${self} on a photo, unless that place picks its own, such as “, ” for “Astoria, Queens”.`}
        value={childRelation}
        fallback="in"
        disabled={disabled}
        onChange={(value) => onChange("childRelation", value)}
      />
    </div>
  );
}

/** A photo place row's connecting word when it comes from the places, in place of the relation menu. */
export function PlacesJoinWord({ word }: { word: string }) {
  return (
    <Link
      to="/places"
      title="Set on the Places page, since this place is one the place above is in"
      className="border-input text-muted-foreground flex h-9 w-32 shrink-0 items-center rounded-md border border-dashed px-2 text-sm"
    >
      {word === "," ? "(comma)" : word}
    </Link>
  );
}
