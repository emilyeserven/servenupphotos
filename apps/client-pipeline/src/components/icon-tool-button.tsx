import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface IconToolButtonProps extends Omit<ComponentProps<typeof Button>, "children" | "size"> {
  /** The button's name, read out by screen readers and shown on hover, such as "Compare". */
  label: string;
  /** Whether the button's mark is on, such as a photo already Undecided: it's then filled in. */
  pressed: boolean;
  icon: ReactNode;
}

/** How an icon tool looks: filled in while its mark is on, faint while it's off. */
const LOOKS = {
  on: { variant: "secondary" as const, className: "rounded-none" },
  off: { variant: "ghost" as const, className: "text-muted-foreground rounded-none" },
};

/**
 * An icon-only button whose name shows in a tooltip on hover or focus, filled in while its mark is
 * on. A row of them in an `IconToolGroup` makes a button group, such as each Gallery tile's
 * Compare, Undecided and Re-edit.
 */
export function IconToolButton({ label, pressed, icon, className, ...props }: IconToolButtonProps) {
  const look = LOOKS[pressed ? "on" : "off"];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={look.variant}
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          className={cn(look.className, className)}
          {...props}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A row of `IconToolButton`s joined into one bordered button group. */
export function IconToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-background inline-flex divide-x overflow-hidden rounded-md border"
    >
      {children}
    </div>
  );
}
