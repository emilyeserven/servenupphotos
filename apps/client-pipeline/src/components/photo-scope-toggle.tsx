import type { AutogroupScope } from "@/lib/compare-autogroup";
import { cn } from "@/lib/utils";

const SCOPES: [AutogroupScope, string][] = [
  ["all", "All photos"],
  ["drafts", "Draft photos"],
];

interface PhotoScopeToggleProps {
  /** What the choice is for, read out by screen readers, such as "Which photos to group". */
  label: string;
  value: AutogroupScope;
  onChange: (scope: AutogroupScope) => void;
}

/** Whether a page asks about every photo, or only the drafts, as two buttons side by side. */
export function PhotoScopeToggle({ label, value, onChange }: PhotoScopeToggleProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-background flex shrink-0 self-start rounded-md border p-0.5 text-sm"
    >
      {SCOPES.map(([scope, text]) => (
        <button
          key={scope}
          type="button"
          aria-pressed={value === scope}
          onClick={() => onChange(scope)}
          className={cn(
            "focus-visible:ring-ring rounded px-3 py-1 outline-none focus-visible:ring-2",
            value === scope
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
