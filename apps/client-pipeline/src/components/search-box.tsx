import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** What's searched, read out for the box, such as "Search albums". */
  label: string;
}

/** A text box with a magnifier in it that narrows a list to what has the typed text. */
export function SearchBox({ value, onChange, label }: SearchBoxProps) {
  return (
    <div className="relative w-full max-w-xs">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        aria-label={label}
        placeholder="Search"
        className="pl-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
