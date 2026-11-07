import { Info } from "lucide-react";
import { Button } from "@portfolio/components/ui/button";
import { cn } from "@portfolio/lib/utils";

/**
 * The (i) button that shows or hides more about a part of a picker, like the Graph page's presets:
 * pressed in while it's showing. `label` names what it shows, such as "what each choice does".
 */
export function InfoButton({
  open,
  label,
  onClick,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  const title = `${open ? "Hide" : "Show"} ${label}`;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={open}
      aria-label={title}
      title={title}
      onClick={onClick}
      className={cn("size-7 shrink-0 text-muted-foreground", open && "bg-accent text-foreground")}
    >
      <Info aria-hidden />
    </Button>
  );
}
