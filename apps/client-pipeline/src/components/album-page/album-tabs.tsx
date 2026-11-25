import { Link } from "@tanstack/react-router";
import { tabsListVariants } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** An album page's tabs, each its own address: Photos opens at the album's own. */
const TABS = [
  { label: "Photos", to: "/albums/$id" },
  { label: "Info", to: "/albums/$id/info" },
  { label: "Layout", to: "/albums/$id/layout" },
] as const;

/** The links between an album's Photos, Info and Layout tabs, the open one marked. */
export function AlbumTabs({ id }: { id: string }) {
  return (
    <nav aria-label="Album tabs" className={cn(tabsListVariants(), "self-start")}>
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          params={{ id }}
          activeOptions={{ exact: true, includeSearch: false }}
          className="text-foreground/60 hover:text-foreground data-[status=active]:bg-background data-[status=active]:text-foreground dark:data-[status=active]:border-input dark:data-[status=active]:bg-input/30 inline-flex h-[calc(100%-1px)] items-center rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-all"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
