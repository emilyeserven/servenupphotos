import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MoveArrowsProps {
  /** What's moved, for the buttons' labels, such as a photo's title. */
  name: string;
  /** Its place in its list, 0 first. */
  place: number;
  last: boolean;
  onMove: (from: number, to: number) => void;
}

/** Arrows that move an item in a list of tiles one place earlier or later, for a keyboard or a touch screen. */
export function MoveArrows({ name, place, last, onMove }: MoveArrowsProps) {
  return (
    <>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Move ${name} earlier`}
        disabled={place === 0}
        onClick={() => onMove(place, place - 1)}
      >
        <ArrowLeftIcon aria-hidden />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Move ${name} later`}
        disabled={last}
        onClick={() => onMove(place, place + 1)}
      >
        <ArrowRightIcon aria-hidden />
      </Button>
    </>
  );
}
