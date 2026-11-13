import { Link } from "@tanstack/react-router";
import { MenuIcon, Settings } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SiteHomeLink } from "@/components/site-home-link";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function SiteMenu() {
  const [open, setOpen] = useState(false);

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
        <Link
          to="/settings"
          onClick={() => setOpen(false)}
          className={cn(LINK_CLASSES, "mt-1 gap-2 px-2 py-1.5 text-xs")}
          activeProps={ACTIVE_PROPS}
        >
          <Settings className="size-3.5" aria-hidden />
          Settings
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/** How each link in the site menu looks: the views' and Settings'. */
const LINK_CLASSES =
  "flex items-center rounded-md font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-40";

/** What a site menu link gets on its own page: highlighted, and marked as the current page. */
const ACTIVE_PROPS = {
  className: "bg-accent text-accent-foreground",
  "aria-current": "page",
} as const;

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
      className={cn(LINK_CLASSES, className)}
      activeProps={ACTIVE_PROPS}
    >
      {children}
    </Link>
  );
}
