import { Link } from "@tanstack/react-router";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Fragment, type ReactNode, useRef, useState } from "react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { isUnder, pagePath, type NavPage } from "@/components/sidebar/nav-groups";
import { cn } from "@/lib/utils";

/** How long the flyout stays after the pointer leaves, so it can cross the gap to the flyout. */
const closeDelayMs = 150;

interface NavFlyoutProps {
  page: NavPage;
  pathname: string;
  /** The page's own link in the sidebar, which the flyout opens beside. */
  trigger: ReactNode;
}

/**
 * A page's submenu on a desktop: hovering or focusing the page flies out a panel to its right with
 * the page's name and the pages under it, whether the sidebar is expanded or collapsed to icons.
 */
export function NavFlyout({ page, pathname, trigger }: NavFlyoutProps) {
  const { open, show, hide } = useHoverOpen();
  return (
    <Popover open={open}>
      <PopoverPrimitive.Anchor asChild>
        <div onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide}>
          {trigger}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="flex w-48 flex-col gap-0.5 p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {[page, ...(page.children ?? [])].map((p, i) => (
          <Fragment key={pagePath(p)}>
            {p.heading && <SubmenuHeading title={p.heading} />}
            <FlyoutLink page={p} active={activeIn(pathname, p, page)} heading={i === 0} />
          </Fragment>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Whether a flyout link is the open page: the page itself only while none of the pages under it is
 * open, so /update-data/colors marks Colors and not Update Data too.
 */
function activeIn(pathname: string, link: NavPage, parent: NavPage) {
  if (link !== parent) return isUnder(pathname, pagePath(link));
  return isUnder(pathname, pagePath(parent)) && !inChildren(pathname, parent);
}

function inChildren(pathname: string, page: NavPage) {
  return (page.children ?? []).some((c) => isUnder(pathname, pagePath(c)));
}

function FlyoutLink({
  page,
  active,
  heading,
}: {
  page: NavPage;
  active: boolean;
  heading: boolean;
}) {
  return (
    <Link
      to={page.url}
      params={{ section: page.section }}
      className={cn(
        "hover:bg-accent flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs [&>svg]:size-4",
        active && "bg-accent font-medium",
        heading && "text-muted-foreground font-medium",
      )}
    >
      <page.icon />
      <span>{page.title}</span>
    </Link>
  );
}

/**
 * A small header above a group of pages in a submenu, such as Tools under Tags, with a line above it
 * to set it apart from the pages before it.
 */
export function SubmenuHeading({ title }: { title: string }) {
  return (
    <div className="text-muted-foreground mt-1 border-t px-2 pb-0.5 pt-2 text-[0.7rem] font-medium uppercase tracking-wide">
      {title}
    </div>
  );
}

/** Open while the pointer or focus is on the icon or the flyout, closing a moment after it leaves both. */
function useHoverOpen() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), closeDelayMs);
  };
  return { open, show, hide };
}
