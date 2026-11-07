import { Link, useLocation, useMatches } from "@tanstack/react-router";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { navTrail, pagePath, type NavPage } from "@/components/sidebar/nav-groups";

/**
 * The header's breadcrumbs: the open page's sidebar section, the page its submenu is under, the page
 * itself, and the subpage when the route names one, such as Organize › Tags › Small Tags or
 * Pipeline › Lightroom Albums › Import. On a phone only the open page (or subpage) shows.
 */
export function NavBreadcrumbs() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const subpage = useMatches({ select: (matches) => matches.at(-1)?.staticData.subpage });
  const trail = navTrail(pathname);
  if (!trail) return null;
  const last = trail.pages.length - 1;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">{trail.group}</BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        {trail.pages.map((page, i) => (
          <PageCrumb key={pagePath(page)} page={page} current={i === last && !subpage} />
        ))}
        {subpage && (
          <BreadcrumbItem>
            <BreadcrumbPage>{subpage}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** One page in the breadcrumbs: a link back to it, or just its name when it's the open page. */
function PageCrumb({ page, current }: { page: NavPage; current: boolean }) {
  if (current) {
    return (
      <BreadcrumbItem>
        <BreadcrumbPage>{page.title}</BreadcrumbPage>
      </BreadcrumbItem>
    );
  }
  return (
    <Fragment>
      <BreadcrumbItem className="hidden md:inline-flex">
        <BreadcrumbLink asChild>
          <Link to={page.url} params={{ section: page.section }}>
            {page.title}
          </Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="hidden md:block" />
    </Fragment>
  );
}
