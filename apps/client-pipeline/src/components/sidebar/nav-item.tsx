import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavFlyout } from "@/components/sidebar/nav-flyout";
import { isUnder, isWithin, type NavPage } from "@/components/sidebar/nav-groups";
import { cn } from "@/lib/utils";

interface NavItemProps {
  page: NavPage;
  /** Closes the sidebar's sheet on a phone after a link is followed. */
  onNavigate: () => void;
}

/** One page in the sidebar: a plain link, or one with a submenu when it has pages under it. */
export function NavItem({ page, onNavigate }: NavItemProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  if (!page.children) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isUnder(pathname, page.url)} tooltip={page.title}>
          <PageLink page={page} onNavigate={onNavigate} />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  return <NavItemWithSubmenu page={page} subpages={page.children} onNavigate={onNavigate} />;
}

/** A page's link: its icon and its name. */
function PageLink({ page, onNavigate, ...props }: NavItemProps & { className?: string }) {
  return (
    <Link to={page.url} onClick={onNavigate} {...props}>
      <page.icon />
      <span>{page.title}</span>
    </Link>
  );
}

/**
 * A page with a submenu. Expanded, the pages under it are listed below it, open while one of them
 * (or the page itself) is showing and toggled by the arrow on the right. Collapsed to a rail of
 * icons, they fly out to the right on hover instead.
 */
function NavItemWithSubmenu({
  page,
  subpages,
  onNavigate,
}: NavItemProps & { subpages: readonly NavPage[] }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  // Until the arrow is clicked, the submenu follows whether one of its pages is showing.
  const [toggled, setToggled] = useState<boolean>();
  const open = toggled ?? isWithin(pathname, page);

  return (
    <SidebarMenuItem>
      <ParentButton page={page} pathname={pathname} onNavigate={onNavigate} />
      <SubmenuToggle title={page.title} open={open} onToggle={() => setToggled(!open)} />
      {open && <Submenu subpages={subpages} pathname={pathname} onNavigate={onNavigate} />}
    </SidebarMenuItem>
  );
}

interface SubmenuToggleProps {
  title: string;
  open: boolean;
  onToggle: () => void;
}

/** The arrow right of a page with a submenu, which shows or hides the pages under it. */
function SubmenuToggle({ title, open, onToggle }: SubmenuToggleProps) {
  return (
    <SidebarMenuAction
      aria-label={`${open ? "Hide" : "Show"} pages under ${title}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      <ChevronRightIcon className={cn("transition-transform", open && "rotate-90")} />
    </SidebarMenuAction>
  );
}

/** The link to the page a submenu is under, which flies its submenu out when the sidebar is collapsed. */
function ParentButton({ page, pathname, onNavigate }: NavItemProps & { pathname: string }) {
  const { state, isMobile } = useSidebar();
  const button = (
    <SidebarMenuButton asChild isActive={isUnder(pathname, page.url)}>
      <PageLink page={page} onNavigate={onNavigate} />
    </SidebarMenuButton>
  );
  if (state !== "collapsed" || isMobile) return button;
  return <NavFlyout page={page} pathname={pathname} trigger={button} />;
}

interface SubmenuProps {
  subpages: readonly NavPage[];
  pathname: string;
  onNavigate: () => void;
}

/** The pages under one, listed below it in the expanded sidebar. */
function Submenu({ subpages, pathname, onNavigate }: SubmenuProps) {
  return (
    <SidebarMenuSub>
      {subpages.map((child) => (
        <SidebarMenuSubItem key={child.url}>
          <SidebarMenuSubButton asChild isActive={isUnder(pathname, child.url)}>
            <PageLink page={child} onNavigate={onNavigate} />
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}
