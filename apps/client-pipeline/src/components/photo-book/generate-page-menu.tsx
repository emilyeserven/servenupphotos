import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GENERATED_KINDS, type GeneratedKind } from "@/lib/photo-book-generated";

/**
 * **Generate page**, in the Book tab's drawer: the kinds of page made from the book's own data,
 * such as a Places Index, each adding one at the end of the book.
 */
export function GeneratePageMenu({ onAdd }: { onAdd: (kind: GeneratedKind) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <SparklesIcon />
          Generate page
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-1 p-1 text-sm">
        {GENERATED_KINDS.map((info) => (
          <button
            key={info.kind}
            type="button"
            onClick={() => onAdd(info.kind)}
            className="hover:bg-muted flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left"
          >
            <span className="font-medium">{info.name}</span>
            <span className="text-muted-foreground text-xs">{info.help}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
