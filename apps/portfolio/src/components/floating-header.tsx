import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A full-page view's title and how many photos it shows, with its controls beside it on wider
 * screens and under it on phones, floating over the view's top left corner so the view (the Map,
 * or the Color page's wheel) can fill the page. It leaves room on the right for the site menu, and
 * clicks between the controls reach the view.
 */
export function FloatingHeader({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute top-4 right-16 left-4 z-10 flex flex-col items-start gap-2 md:flex-row md:items-center [&>div>*]:pointer-events-auto">
      <header className="pointer-events-auto flex shrink-0 items-baseline gap-3 rounded-md border bg-background/90 px-3 py-1.5 shadow-xs backdrop-blur-sm dark:border-input">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? "photo" : "photos"}
        </p>
      </header>
      {children}
    </div>
  );
}
