import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

interface SourceSelectProps<T extends string> {
  /** The choices, each its value and name, such as Photon. */
  choices: { value: T; label: string }[];
  value: T;
  /** Names the menu for screen readers, such as "Leaves: search with". */
  label: string;
  /** Says how the choices differ, on hover. */
  hint: string;
  onChange: (value: T) => void;
}

/** A small menu picking which service a look-up asks, such as Photon or Overpass. */
export function SourceSelect<T extends string>(props: SourceSelectProps<T>) {
  const { choices, value, label, hint, onChange } = props;
  return (
    <select
      value={value}
      aria-label={label}
      title={hint}
      onChange={(e) => onChange(e.target.value as T)}
      className={`${SELECT_CLASS} w-auto shrink-0`}
    >
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
