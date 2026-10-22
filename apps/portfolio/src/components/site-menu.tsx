import { Link } from "@tanstack/react-router";
import { MenuIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import { useScriptDisplay } from "@/components/script-display-provider";
import { type Theme, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ScriptDisplay } from "@/lib/localize";
import { parseFilters } from "@/lib/photo-filters";
import { portfolioViews } from "@/lib/portfolio-views";
import { cn } from "@/lib/utils";

interface Option<T> {
  value: T;
  label: string;
  Icon?: typeof SunIcon;
}

const themeOptions: Option<Theme>[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

// Least to most native. A name without the chosen way saved shows the most native way it has
// short of it, down to English.
const scriptOptions: Option<ScriptDisplay>[] = [
  { value: "english", label: "English" },
  { value: "romanized", label: "Romanized" },
  { value: "phonetic", label: "Phonetic" },
  { value: "native", label: "Native" },
];

export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { script, setScript } = useScriptDisplay();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open menu"
          className="bg-muted shadow-sm dark:bg-muted"
        >
          <MenuIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(18rem,calc(100vw-2rem))] p-2">
        <nav aria-label="Portfolio views">
          <ul className="grid grid-cols-3 gap-1">
            {portfolioViews.map(({ to, label, icon: Icon, enabled }) => (
              <li key={to}>
                <Link
                  to={to}
                  // Only the filters go along: the other settings belong to the view they're on.
                  search={(prev: Record<string, unknown>) => parseFilters(prev)}
                  disabled={!enabled}
                  onClick={() => setOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-md px-1 py-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
                  activeProps={{
                    className: "bg-accent text-accent-foreground",
                    "aria-current": "page",
                  }}
                >
                  <Icon className="size-6" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p
          id="script-display-label"
          className="mt-3 px-1 pb-1 text-xs font-medium text-muted-foreground"
        >
          Script display
        </p>
        <Choices
          labelledBy="script-display-label"
          options={scriptOptions}
          value={script}
          onChange={setScript}
        />
        <Choices
          label="Color theme"
          className="mt-2"
          options={themeOptions}
          value={theme}
          onChange={setTheme}
        />
      </PopoverContent>
    </Popover>
  );
}

interface ChoicesProps<T extends string> {
  label?: string;
  labelledBy?: string;
  className?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A row of buttons that picks one of the options, like radio buttons. */
function Choices<T extends string>({
  label,
  labelledBy,
  className,
  options,
  value,
  onChange,
}: ChoicesProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn("flex rounded-md border bg-muted/50 p-0.5", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-1.5 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            value === option.value && "bg-background text-foreground shadow-xs",
          )}
        >
          {option.Icon && <option.Icon className="size-3.5" aria-hidden />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
