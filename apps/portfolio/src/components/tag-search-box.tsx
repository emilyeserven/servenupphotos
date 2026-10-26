import { Search } from "lucide-react";

/** The Tags page's search box, which narrows the tags to ones with the text in their name or description. */
export function TagSearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2.5 shadow-xs focus-within:ring-2 focus-within:ring-ring sm:w-64 dark:border-input dark:bg-input/30">
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">Search tags</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tags…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
