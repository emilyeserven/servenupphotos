import { cn } from "@portfolio/lib/utils";

/** A section in a picker's left list, such as the Colors or Graph type picker: its name, with what it's set to under it. */
export function SectionTab({
  label,
  text,
  chosen,
  onClick,
}: {
  label: string;
  text: string;
  chosen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={chosen}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        chosen && "bg-background shadow-xs",
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="w-full truncate text-xs text-muted-foreground">{text}</span>
    </button>
  );
}
