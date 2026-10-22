import { ChevronDownIcon } from "lucide-react";
import { type MouseEvent, type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/hooks/use-dismiss";
import { cn } from "@/lib/utils";

interface FloatingFlyoutProps {
  /** What the button shows before its label, such as an icon or a spinner. */
  icon: ReactNode;
  label: string;
  /** What the flyout is about, for screen readers, such as "R2 upload". */
  title: string;
  /** Filled while the button's action is waiting to be done, outlined once it's done. */
  variant: "default" | "outline";
  /** What clicking the button does, after which the flyout opens; without it, the button only opens and closes the flyout. */
  onRun?: () => void;
  disabled?: boolean;
  /** The flyout's contents. */
  children: ReactNode;
}

/** The split pill's two halves, which share one rounded outline. */
const HALF = "h-9 shadow-md";

/**
 * A pill for a page's action, meant for a FloatingAction next to the sync button, with a chevron
 * opening a flyout under it, at the right, with the action's details. Below the sm breakpoint only the
 * icon shows, so the floating actions fit next to the sync button on a phone.
 */
export function FloatingFlyout({
  icon,
  label,
  title,
  variant,
  onRun,
  disabled,
  children,
}: FloatingFlyoutProps) {
  const [open, setOpen] = useState(false);
  // Where the flyout's top goes: just under the buttons, which wrap onto two rows on a phone.
  const [top, setTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, [ref], () => setOpen(false));
  // Clicked is one of the pill's halves, so its bottom is the pill's.
  const show = (next: boolean, clicked: HTMLElement) => {
    setTop(clicked.getBoundingClientRect().bottom + 8);
    setOpen(next);
  };
  const toggle = (event: MouseEvent<HTMLElement>) => show(!open, event.currentTarget);
  const run =
    onRun &&
    ((event: MouseEvent<HTMLElement>) => {
      onRun();
      show(true, event.currentTarget);
    });

  return (
    <div ref={ref} className="flex">
      <Button
        variant={variant}
        disabled={disabled}
        onClick={run ?? toggle}
        title={label}
        className={cn(HALF, "rounded-l-full rounded-r-none border-r-0 pr-2")}
      >
        {icon}
        <span className="max-sm:sr-only">{label}</span>
      </Button>
      <Chevron variant={variant} title={title} open={open} onClick={toggle} />
      {open && (
        <Panel title={title} top={top}>
          {children}
        </Panel>
      )}
    </div>
  );
}

interface ChevronProps {
  variant: FloatingFlyoutProps["variant"];
  title: string;
  open: boolean;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

/** The pill's right half, opening and closing the flyout. */
function Chevron({ variant, title, open, onClick }: ChevronProps) {
  return (
    <Button
      variant={variant}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`${open ? "Hide" : "Show"} ${title} details`}
      onClick={onClick}
      className={cn(
        HALF,
        "w-8 rounded-l-none rounded-r-full border-l px-0",
        variant === "default" && "border-primary-foreground/25",
      )}
    >
      <ChevronDownIcon className={cn("transition-transform", open && "rotate-180")} />
    </Button>
  );
}

/** The flyout, at the top right under the floating buttons. */
function Panel({ title, top, children }: { title: string; top: number; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-label={title}
      style={{ top, maxHeight: `calc(100vh - ${top + 16}px)` }}
      className="bg-popover text-popover-foreground fixed right-4 z-40 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-xl border p-4 text-sm shadow-lg"
    >
      {children}
    </div>
  );
}
