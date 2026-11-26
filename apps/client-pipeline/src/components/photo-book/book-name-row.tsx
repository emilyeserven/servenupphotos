import { Input } from "@/components/ui/input";
import { count } from "@portfolio/lib/words";

interface BookNameRowProps {
  /** The lens or camera, as the photos' data names it. */
  name: string;
  /** How many photos on the book's pages have it. */
  photos: number;
  /** What's typed in its box. */
  value: string;
  /** What its box shows while empty. */
  placeholder: string;
  /** What a screen reader says the box is for. */
  label: string;
  /** How the book's captions write it with what's typed. */
  note: string;
  onChange: (value: string) => void;
}

/**
 * One lens or camera on a book's Info tab: its name, how many photos have it, a box for how the
 * book's captions change it, and how they write it then.
 */
export function BookNameRow({
  name,
  photos,
  value,
  placeholder,
  label,
  note,
  onChange,
}: BookNameRowProps) {
  return (
    <li className="grid gap-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] sm:items-center sm:gap-3">
      <span className="text-sm">
        {name} <span className="text-muted-foreground text-xs">({count(photos, "photo")})</span>
      </span>
      <Input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 text-sm"
      />
      <span className="text-muted-foreground text-xs">{note}</span>
    </li>
  );
}
