import { FieldLabel } from "@/components/field-label";
import { RegionOverrideField } from "@/components/region-override-field";

/** Where a city or state is: a city's state and country, or a state's country, as written. */
export interface RegionWhere {
  state: string;
  country: string;
}

/** Nothing written for where a city or state is. */
export const NO_WHERE: RegionWhere = { state: "", country: "" };

/** How to fill in each field, shown beside its title. */
const HELP = {
  state:
    "Optional. The state, province or prefecture the city is in, such as Gyeonggi for Suwon. Choosing a known one fills in its country.",
  country: "Optional, such as South Korea. Choose one places are in or photos show, or type one.",
};

interface RegionWhereFieldsProps {
  /** A city has a state and a country; a state has only a country. */
  kind: "city" | "state";
  value: RegionWhere;
  /** What each field shows while it's empty, such as the state its photos give it. */
  placeholder?: RegionWhere;
  disabled: boolean;
  onChange: (next: RegionWhere) => void;
}

/**
 * The state and country a city is in, or the country a state is in, each chosen from the ones
 * places are in or photos show, or typed. Choosing a state whose country is known fills in the
 * country when it's empty.
 */
export function RegionWhereFields({
  kind,
  value,
  placeholder = NO_WHERE,
  disabled,
  onChange,
}: RegionWhereFieldsProps) {
  const chooseState = (state: string, country?: string) =>
    onChange({ state, country: value.country || (country ?? "") });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {kind === "city" && (
        <WhereField
          kind="state"
          label="State"
          value={value.state}
          placeholder={placeholder.state}
          disabled={disabled}
          onChange={chooseState}
        />
      )}
      <WhereField
        kind="country"
        label="Country"
        value={value.country}
        placeholder={placeholder.country}
        disabled={disabled}
        onChange={(country) => onChange({ ...value, country })}
      />
    </div>
  );
}

interface WhereFieldProps {
  kind: "state" | "country";
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (name: string, country?: string) => void;
}

/** One of the fields, with its title and how to fill it in. */
function WhereField({ kind, label, value, placeholder, disabled, onChange }: WhereFieldProps) {
  const id = `region-where-${kind}`;
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} help={HELP[kind]}>
        {label}
      </FieldLabel>
      <RegionOverrideField
        id={id}
        kind={kind}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
