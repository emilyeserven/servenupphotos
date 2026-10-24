import { ChevronRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface FieldSectionProps {
  title: string;
  /** What's set, shown beside the title while it's collapsed. */
  summary: string;
  /** Whether it starts open. */
  defaultOpen: boolean;
  /** Classes for the fields under the title. */
  className?: string;
  children: ReactNode;
}

/** A bordered section of the Photo page's fields that collapses to its title and a summary. */
export function FieldSection({
  title,
  summary,
  defaultOpen,
  className,
  children,
}: FieldSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-md border"
    >
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-4 shrink-0 transition-transform group-open:rotate-90" />
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground min-w-0 truncate">{summary}</span>
      </summary>
      <div className={cn("px-3 pt-1 pb-3", className)}>{children}</div>
    </details>
  );
}
