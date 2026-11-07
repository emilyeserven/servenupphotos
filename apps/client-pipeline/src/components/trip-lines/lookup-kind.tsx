import { cn } from "@/lib/utils";

/** The kinds a transit hop's lines can be looked up as, by the mode the backend asks for. */
const LOOKUP_KINDS: { mode: string; label: string }[] = [
  { mode: "train", label: "Train" },
  { mode: "subway", label: "Subway" },
  { mode: "bus", label: "Bus" },
  { mode: "ferry", label: "Ferry" },
];

interface LookupKindProps {
  /** The hop's mode; only a transit hop, whose kind isn't known, asks. */
  mode: string;
  /** The kind picked to look lines up as, if any. */
  kind?: string;
  disabled: boolean;
  onKind: (kind: string) => void;
}

/**
 * For a transit hop, which kind of line to look for. Lines are only looked up once one is
 * picked, since looking for every kind at once is slow on OpenStreetMap's servers.
 */
export function LookupKind({ mode, kind, disabled, onKind }: LookupKindProps) {
  if (mode !== "transit") return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      <span className="text-muted-foreground mr-1">Look for a</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Kind of line to look for">
        {LOOKUP_KINDS.map((k) => (
          <button
            key={k.mode}
            type="button"
            disabled={disabled}
            aria-pressed={kind === k.mode}
            onClick={() => onKind(k.mode)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs disabled:opacity-50",
              kind === k.mode && "bg-muted font-medium",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      {!kind && <span className="text-muted-foreground">line to find lines.</span>}
    </div>
  );
}
