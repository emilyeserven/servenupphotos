import type { MetaFieldInfo } from "@/api/metainfo";
import { type MetaValueCount, showValue } from "@/lib/meta-values";

interface MetaUncoveredProps {
  info: MetaFieldInfo;
  /** The values no group covers, from `uncoveredValues`. */
  values: MetaValueCount[];
  /** What they aren't in, such as "any group" or "its subgroups". */
  outside: string;
  /** What every value is in when none is left out, such as "a group". */
  inside: string;
}

/** The photos' values that aren't in any group (or any subgroup), each with how many photos have it. */
export function MetaUncovered({ info, values, outside, inside }: MetaUncoveredProps) {
  if (values.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Every {info.one} the photos have is in {inside}.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium">Not in {outside}:</p>
      <ul className="flex flex-wrap gap-1.5" aria-label={`Not in ${outside}`}>
        {values.map(({ value, count }) => (
          <li
            key={JSON.stringify(value)}
            className="rounded-full border border-dashed px-2 py-0.5 text-xs"
          >
            {showValue(info.field, value)} <span className="text-muted-foreground">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
