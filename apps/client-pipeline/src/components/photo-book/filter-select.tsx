/** One choice of a FilterSelect: the value it filters on and what it says. */
interface FilterOption {
  value: string;
  label: string;
}

/**
 * A small dropdown that filters a list: its everything choice (such as **All tags**) first, then
 * each option; nothing when there are no options.
 */
export function FilterSelect(props: {
  /** What it filters by, for screen readers, such as "Show pages tagged". */
  label: string;
  /** What the everything choice says, such as "All tags". */
  all: string;
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { label, all, options, value, onChange } = props;
  if (options.length === 0) return null;
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className="border-input dark:bg-input/30 h-7 max-w-40 min-w-0 rounded-md border bg-transparent px-1.5 text-xs shadow-xs"
    >
      <option value="">{all}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
