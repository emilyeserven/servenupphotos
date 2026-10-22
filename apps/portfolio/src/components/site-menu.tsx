import { Link } from "@tanstack/react-router";
import { MenuIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import { type Theme, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { portfolioViews } from "@/lib/portfolio-views";
import { cn } from "@/lib/utils";

const themeOptions: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

// Views linked in the menu but not ready to visit yet.
const disabledViews = new Set<string>(["/spotlight", "/color"]);

export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

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
            {portfolioViews.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  disabled={disabledViews.has(to)}
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
        <div
          role="radiogroup"
          aria-label="Color theme"
          className="mt-2 flex rounded-md border bg-muted/50 p-0.5"
        >
          {themeOptions.map(({ value, label, Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  selected && "bg-background text-foreground shadow-xs",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
