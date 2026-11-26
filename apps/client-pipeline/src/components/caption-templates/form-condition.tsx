import {
  CONDITION_FIELDS,
  type ConditionState,
  type PlaceForm,
  conditionState,
  withCondition,
} from "@/lib/caption-place-form";
import { cn } from "@/lib/utils";

/** What each field is called in a form's condition. */
const FIELD_LABELS: Record<string, string> = {
  place1: "1st place",
  place2: "2nd place",
  place3: "3rd place",
  city: "city",
  state: "state",
  country: "country",
};

/** What a click on a field in the condition makes it: needed, then needed empty, then not part of it. */
const NEXT_STATE: Record<ConditionState, ConditionState> = {
  off: "has",
  has: "lacks",
  lacks: "off",
};

/** How each state of a field in the condition looks, and the words before its name. */
const STATE_LOOK: Record<ConditionState, { className: string; prefix: string }> = {
  off: { className: "text-muted-foreground border-dashed", prefix: "" },
  has: { className: "bg-primary/10 border-primary/40 text-foreground", prefix: "has " },
  lacks: { className: "bg-muted text-foreground", prefix: "no " },
};

interface FormConditionProps {
  form: PlaceForm;
  index: number;
  onChange: (form: PlaceForm) => void;
}

/**
 * A form's condition: a button for each field, which a click makes needed ("has city"), then
 * needed empty ("no state"), then not part of the condition. A form with none is for any photo.
 */
export function FormCondition({ form, index, onChange }: FormConditionProps) {
  const states = CONDITION_FIELDS.map((name) => [name, conditionState(form, name)] as const);
  const any = states.every(([, state]) => state === "off");
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-muted-foreground text-xs">
        {any ? "For any photo. Needs:" : "For a photo with:"}
      </span>
      {states.map(([name, state]) => (
        <button
          key={name}
          type="button"
          aria-label={`Form ${index + 1}: ${STATE_LOOK[state].prefix}${FIELD_LABELS[name]}, click to change`}
          className={cn("rounded-full border px-2 py-0.5 text-xs", STATE_LOOK[state].className)}
          onClick={() => onChange(withCondition(form, name, NEXT_STATE[state]))}
        >
          {STATE_LOOK[state].prefix}
          {FIELD_LABELS[name]}
        </button>
      ))}
    </div>
  );
}
