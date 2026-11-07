import type { ShiftSide } from "@/lib/timezone-shift";
import { cn } from "@/lib/utils";

const SIDES: [ShiftSide, string][] = [
  ["before", "Before"],
  ["after", "After"],
  ["skip", "Leave out"],
];

interface SideToggleProps {
  value: ShiftSide;
  onChange: (side: ShiftSide) => void;
  /** Read out with the buttons, such as the photo's name. */
  label: string;
}

/** Whether a photo was taken before or after the timezone change, or is left as it is. */
export function SideToggle({ value, onChange, label }: SideToggleProps) {
  return (
    <div
      role="group"
      aria-label={`When ${label} was taken`}
      className="bg-background flex shrink-0 rounded-md border p-0.5"
    >
      {SIDES.map(([side, text]) => (
        <button
          key={side}
          type="button"
          aria-pressed={value === side}
          onClick={() => onChange(side)}
          className={cn(
            "focus-visible:ring-ring rounded px-2 py-0.5 text-xs outline-none focus-visible:ring-2",
            sideClass(side, value === side),
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** The chosen button stands out, in its side's color; the others are muted. */
function sideClass(side: ShiftSide, chosen: boolean): string {
  if (!chosen) return "text-muted-foreground hover:text-foreground";
  const colors: Record<ShiftSide, string> = {
    before: "bg-secondary text-secondary-foreground font-medium",
    after: "bg-primary text-primary-foreground font-medium",
    skip: "bg-muted text-muted-foreground font-medium line-through",
  };
  return colors[side];
}
