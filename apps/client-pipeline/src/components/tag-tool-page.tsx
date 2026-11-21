import { Page } from "@/components/page";
import { tagTools } from "@/components/update-data/sections";
import { WithGitHub } from "@/components/update-data/sections-layout";

/** One tag tool's page, such as Bulk tagging: its card under its title, once GitHub is set up. */
export function TagToolPage({ slug }: { slug: string }) {
  const tool = tagTools.find((t) => t.slug === slug);
  if (!tool) {
    return (
      <p className="text-muted-foreground p-6 text-sm">There's no tag tool called “{slug}”.</p>
    );
  }
  return (
    <Page title={tool.title} description={tool.description}>
      <WithGitHub render={tool.render} />
    </Page>
  );
}
