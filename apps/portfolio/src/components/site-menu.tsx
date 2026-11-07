import { Link } from "@tanstack/react-router";
import { MenuIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SiteHomeLink } from "@/components/site-home-link";
import { useScriptDisplay } from "@/components/script-display-provider";
import { type Theme, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ScriptDisplay } from "@/lib/localize";
import { parseCameraFilters } from "@/lib/camera-filters";
import { parseFilters } from "@/lib/photo-filters";
import { parseTextSearch } from "@/lib/text-search";
import { mainViews, minorViews, type PortfolioView } from "@/lib/portfolio-views";
import { cn } from "@/lib/utils";
import { rememberedViewOptions } from "@/lib/view-options";

/**
 * What a view link carries: the filters from the page it's on, and the view's own settings as it
 * was last left, such as the Grid's Table view. The camera filters go too, kept by the views that
 * have them (Table, Grid and Graph). The Map always opens with no filters, so it doesn't keep ones set
 * before. The text search goes only between the Grid and the Timeline, the views with a search box.
 */
function carriedSearch(to: PortfolioView["to"], prev: Record<string, unknown>) {
  if (to === "/map") return {};
  return {
    ...rememberedViewOptions(to),
    ...parseFilters(prev),
    ...parseCameraFilters(prev),
    ...carriedTextSearch(to, prev),
  };
}

/** The text search, when the link goes to a view with a search box. */
function carriedTextSearch(to: PortfolioView["to"], prev: Record<string, unknown>) {
  return SEARCHABLE_VIEWS.includes(to) ? parseTextSearch(prev) : {};
}

/** The views with a text search box. */
const SEARCHABLE_VIEWS: readonly string[] = ["/grid", "/timeline"];

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
        <SiteHomeLink
          onClick={() => setOpen(false)}
          className="mb-1 block rounded-md px-2 py-1.5 text-base text-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:no-underline"
        />
        <nav aria-label="Portfolio views">
          <ul className="grid grid-cols-2 gap-1">
            {mainViews.map((view) => (
              <li key={view.to}>
                <ViewLink
                  view={view}
                  onClick={() => setOpen(false)}
                  className="flex-col gap-1.5 px-1 py-3 text-xs"
                >
                  <view.icon className="size-6" aria-hidden />
                  {view.label}
                </ViewLink>
              </li>
            ))}
          </ul>
          <ul className="mt-1 grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-1 border-y py-1">
            {minorViews.map((view) => (
              <li key={view.to}>
                <ViewLink
                  view={view}
                  onClick={() => setOpen(false)}
                  className="gap-2 px-2 py-1.5 text-xs"
                >
                  <view.icon className="size-3.5" aria-hidden />
                  {view.label}
                </ViewLink>
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

interface ViewLinkProps {
  view: PortfolioView;
  onClick: () => void;
  className: string;
  children: ReactNode;
}

/** A link in the site menu to one of the portfolio's views, highlighted on the view's own page. */
function ViewLink({ view, onClick, className, children }: ViewLinkProps) {
  return (
    <Link
      to={view.to}
      search={(prev: Record<string, unknown>) => carriedSearch(view.to, prev)}
      disabled={!view.enabled}
      onClick={onClick}
      className={cn(
        "flex items-center rounded-md font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-40",
        className,
      )}
      activeProps={{
        className: "bg-accent text-accent-foreground",
        "aria-current": "page",
      }}
    >
      {children}
    </Link>
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
