import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FieldLabelProps {
  /** The input the label is for; use `id` instead for a combobox labelled by it. */
  htmlFor?: string;
  id?: string;
  children: ReactNode;
  /** What to write in the field, with an example, shown in a tooltip beside the label. */
  help: string;
}

/** A field's title, with an info button beside it that shows how to fill the field in. */
export function FieldLabel({ htmlFor, id, children, help }: FieldLabelProps) {
  return (
    <div className="flex items-center gap-1">
      <label id={id} htmlFor={htmlFor} className="text-sm font-medium">
        {children}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
            aria-label={`About ${typeof children === "string" ? children : "this field"}`}
          >
            <InfoIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
