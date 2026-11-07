import { Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { settingsQuery, type SettingsResponse } from "@/api/settings";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { SectionNav, type SectionsRoute } from "@/components/update-data/section-nav";
import type { UpdateDataSection } from "@/components/update-data/sections";

interface SectionsLayoutProps {
  /** The page's title, such as Update Data. */
  name: string;
  description: string;
  sections: readonly UpdateDataSection[];
  to: SectionsRoute;
}

/** A page of bulk changes, one subpage each, picked from a side navigation: Update Data or Tag Data. */
export function SectionsLayout({ name, description, sections, to }: SectionsLayoutProps) {
  const current = useParams({ strict: false, select: (params) => params.section });
  return (
    <Page title={name} description={description} wide>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <SectionNav name={name} sections={sections} to={to} current={current} />
        <div className="flex min-w-0 max-w-3xl flex-1 flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </Page>
  );
}

interface SectionCardProps {
  /** The page's title, such as Update Data, for when there's no subpage by this name. */
  name: string;
  sections: readonly UpdateDataSection[];
  slug: string;
}

/** One subpage of Update Data or Tag Data: its card, once GitHub is set up. */
export function SectionCard({ name, sections, slug }: SectionCardProps) {
  const section = sections.find((s) => s.slug === slug);
  if (!section) {
    return (
      <p className="text-muted-foreground text-sm">
        There's no {name} page called “{slug}”.
      </p>
    );
  }
  return <WithGitHub render={section.render} />;
}

/** render, given the saved settings, once Settings have a GitHub repository and token. */
export function WithGitHub({ render }: { render: (settings: SettingsResponse) => ReactNode }) {
  const settings = useQuery(settingsQuery);
  return (
    <QueryResult query={settings}>
      {(data) => (data.github.repo && data.github.token.set ? render(data) : <SetUpGitHub />)}
    </QueryResult>
  );
}

/** What shows instead of a card until GitHub is set up. */
function SetUpGitHub() {
  return (
    <p className="text-muted-foreground text-sm">
      Set the GitHub repository and token in{" "}
      <Link to="/settings" className="text-foreground underline underline-offset-4">
        Settings
      </Link>{" "}
      first.
    </p>
  );
}
