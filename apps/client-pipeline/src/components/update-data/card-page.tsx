import type { ReactNode } from "react";
import { Page } from "@/components/page";
import { WithGitHub } from "@/components/update-data/sections-layout";

interface CardPageProps {
  title: string;
  description: string;
  /** The page's one bulk change card. */
  children: ReactNode;
}

/**
 * A page that's one bulk change card, such as Location Names under Places, once GitHub is set up.
 * These were Update Data subpages before they moved into the sidebar next to what they change.
 */
export function CardPage({ title, description, children }: CardPageProps) {
  return (
    <Page title={title} description={description}>
      <WithGitHub render={() => children} />
    </Page>
  );
}
