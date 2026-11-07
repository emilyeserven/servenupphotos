import { Link, type StaticDataRouteOption, useLocation, useMatches } from "@tanstack/react-router";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { navTrail, pagePath, type NavPage, type NavTrail } from "@/components/sidebar/nav-groups";
import { type Crumb, fixedCrumbs } from "@/components/sidebar/route-crumbs";

const NO_CRUMBS = fixedCrumbs();

/**
 * The header's breadcrumbs: the open page's sidebar section, the page its submenu is under, the page
 * itself, and whatever the route adds after it, such as Organize › Albums › Japan › Tokyo or
 * Configuration › Trip Lines › Wed, Sep 23, 2026 › Route. Every breadcrumb but the last links back
 * to its page. On a phone only the last shows.
 */
export function NavBreadcrumbs() {
  const route = useMatches({ select: (matches) => matches.at(-1) });
  const { crumbs: Crumbs = NO_CRUMBS } = staticDataOf(route);
  // Keyed by the route, so each route's breadcrumbs start fresh.
  return <Crumbs key={route?.routeId}>{(crumbs) => <Trail crumbs={crumbs} />}</Crumbs>;
}

function staticDataOf(route: { staticData: StaticDataRouteOption } | undefined) {
  return route ? route.staticData : {};
}

/** The breadcrumbs themselves: the sidebar's section and pages, then the route's own. */
function Trail({ crumbs }: { crumbs: Crumb[] }) {
  const trail = useTrail();
  if (trail.pages.length + crumbs.length === 0) return null;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.group && <GroupCrumb title={trail.group} />}
        <PageCrumbs pages={trail.pages} last={crumbs.length === 0} />
        {crumbs.map((crumb, i) => (
          <ExtraCrumb key={i} crumb={crumb} current={i === crumbs.length - 1} />
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Where the open page is in the sidebar; no section and no pages when the sidebar doesn't list it. */
function useTrail(): NavTrail {
  const pathname = useLocation({ select: (location) => location.pathname });
  return navTrail(pathname) ?? { group: "", pages: [] };
}

/** The sidebar's pages in the breadcrumbs, the last one unlinked when it's the open page. */
function PageCrumbs({ pages, last }: { pages: NavPage[]; last: boolean }) {
  return pages.map((page, i) => (
    <PageCrumb key={pagePath(page)} page={page} current={last && i === pages.length - 1} />
  ));
}

/** The sidebar section, such as Organize, which isn't a page of its own. */
function GroupCrumb({ title }: { title: string }) {
  return (
    <Fragment>
      <BreadcrumbItem className="hidden md:block">{title}</BreadcrumbItem>
      <BreadcrumbSeparator className="hidden md:block" />
    </Fragment>
  );
}

/** One page in the breadcrumbs: a link back to it, or just its name when it's the open page. */
function PageCrumb({ page, current }: { page: NavPage; current: boolean }) {
  if (current) return <CurrentCrumb title={page.title} />;
  return (
    <LinkedCrumb>
      <Link to={page.url} params={{ section: page.section }}>
        {page.title}
      </Link>
    </LinkedCrumb>
  );
}

/** A breadcrumb the route adds after the sidebar's pages, linked unless it's the open page. */
function ExtraCrumb({ crumb, current }: { crumb: Crumb; current: boolean }) {
  if (current || !crumb.link) return <CurrentCrumb title={crumb.title} current={current} />;
  return (
    <LinkedCrumb>
      <Link {...crumb.link}>{crumb.title}</Link>
    </LinkedCrumb>
  );
}

/** The open page's name, the one breadcrumb a phone shows; a name with no link when it isn't last. */
function CurrentCrumb({ title, current = true }: { title: string; current?: boolean }) {
  if (!current) {
    return (
      <Fragment>
        <BreadcrumbItem className="hidden md:inline-flex">{title}</BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
      </Fragment>
    );
  }
  return (
    <BreadcrumbItem>
      <BreadcrumbPage>{title}</BreadcrumbPage>
    </BreadcrumbItem>
  );
}

/** A breadcrumb that links back to its page, hidden on a phone, and the separator after it. */
function LinkedCrumb({ children }: { children: React.ReactNode }) {
  return (
    <Fragment>
      <BreadcrumbItem className="hidden md:inline-flex">
        <BreadcrumbLink asChild>{children}</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="hidden md:block" />
    </Fragment>
  );
}
