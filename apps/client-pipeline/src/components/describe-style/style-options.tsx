import { ShuffleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maxStyleCount, styleCount } from "@/lib/style-prompt";

interface StyleOptionsProps {
  /** How many photos to link, as typed. */
  count: string;
  onCount: (value: string) => void;
  /** Whether the photos were picked at random rather than spread evenly. */
  shuffled: boolean;
  onShuffle: () => void;
  onSpread: () => void;
}

/** How many photos the style prompt links, and whether they're spread evenly or shuffled. */
export function StyleOptions({ count, onCount, shuffled, onShuffle, onSpread }: StyleOptionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        Photos to link
        <Input
          type="number"
          min={1}
          max={maxStyleCount}
          step={1}
          className="w-20"
          value={count}
          onChange={(event) => onCount(event.target.value)}
          onBlur={() => onCount(String(styleCount(count)))}
        />
      </label>
      <Button type="button" variant="outline" onClick={onShuffle}>
        <ShuffleIcon />
        Shuffle
      </Button>
      {shuffled && (
        <Button type="button" variant="ghost" onClick={onSpread}>
          Spread evenly again
        </Button>
      )}
    </div>
  );
}
