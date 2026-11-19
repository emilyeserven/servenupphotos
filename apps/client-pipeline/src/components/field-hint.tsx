import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** A card's title, with what happens to its details when they're saved on hover beside it. */
export function CardTitleWithHint({ title, description }: { title: string; description: string }) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-1.5">
        {title}
        <Hint label={`About ${title.toLowerCase()}`}>{description}</Hint>
      </CardTitle>
    </CardHeader>
  );
}

interface LabeledHintProps {
  /** The id of the field inside, which the label points to. */
  id: string;
  label: string;
  hint: ReactNode;
  children: ReactNode;
}

/** A field with its label, and its hint on hover beside the label. */
export function LabeledHint({ id, label, hint, children }: LabeledHintProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Hint label={`About ${label}`} id={`${id}-hint`}>
          {hint}
        </Hint>
      </div>
      {children}
    </div>
  );
}

interface HintProps {
  /** What the info button is called for screen readers. */
  label: string;
  /** An id for the hint's text, which stays in the page for aria-describedby. */
  id?: string;
  children: ReactNode;
}

/** An info icon showing helper text on hover or focus, to keep it from cluttering the form. */
export function Hint({ label, id, children }: HintProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
          >
            <InfoIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs font-normal">{children}</TooltipContent>
      </Tooltip>
      {id && (
        <span id={id} className="sr-only">
          {children}
        </span>
      )}
    </>
  );
}
