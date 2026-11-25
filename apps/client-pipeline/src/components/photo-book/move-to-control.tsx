import { ArrowRightLeftIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MoveToControlProps {
  /** What the page or spread is called, for the labels. */
  name: string;
  /** Its position among the photo pages, 1 first. */
  position: number;
  /** How many photo pages and spreads there are. */
  total: number;
  /** Moves it to the position typed, 1 first. */
  onMoveTo: (position: number) => void;
  /** The button that opens it; **Move to…** when left out. */
  children?: ReactNode;
}

/**
 * **Move to…** on a photo page or spread: a flyout to type the position to move it to among the
 * photo pages, 1 first, a spread moving as one.
 */
export function MoveToControl({ name, position, total, onMoveTo, children }: MoveToControlProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button size="xs" variant="ghost" aria-label={`Move ${name} to a position`}>
            <ArrowRightLeftIcon />
            Move to…
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-3">
        <MoveToForm
          key={String(open)}
          position={position}
          total={total}
          onMoveTo={(to) => {
            onMoveTo(to);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** The flyout's number box, starting at the current position, and **Move**. */
function MoveToForm(props: Omit<MoveToControlProps, "name" | "children">) {
  const { position, total, onMoveTo } = props;
  const [typed, setTyped] = useState(String(position));
  const to = Number(typed);
  const valid = typed.trim() !== "" && Number.isInteger(to) && to !== position;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onMoveTo(to);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-xs">
      <label className="flex items-center gap-2">
        Move to position
        <Input
          type="number"
          min={1}
          max={total}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className="h-7 w-16"
          autoFocus
        />
        <span className="text-muted-foreground">of {total}</span>
      </label>
      <Button type="submit" size="xs" disabled={!valid} className="self-start">
        Move
      </Button>
    </form>
  );
}
