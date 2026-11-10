import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { settingsQuery } from "@/api/settings";
import { InstagramCalendar } from "@/components/instagram-calendar";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";

/** The Instagram page's search: which tab is open, left out for the Calendar. */
interface InstagramSearch {
  tab?: "feed";
}

export const Route = createFileRoute("/instagram")({
  validateSearch: (search: Record<string, unknown>): InstagramSearch =>
    search.tab === "feed" ? { tab: "feed" } : {},
  component: InstagramPage,
});

/**
 * A calendar of the photos scheduled to post to Instagram, saved as `socialMediaPublishDate`,
 * and in its own tab the Social Feed preview.
 */
function InstagramPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      wide
      title="Instagram"
      description="Schedule one photo a day to post to Instagram. Changes are saved to each photo's JSON as its socialMediaPublishDate, waiting for Commit."
    >
      <QueryResult query={settings}>
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <InstagramCalendar />
          ) : (
            <p className="text-muted-foreground text-sm">
              Set the GitHub repository and token in{" "}
              <Link to="/settings" className="text-foreground underline underline-offset-4">
                Settings
              </Link>{" "}
              first.
            </p>
          )
        }
      </QueryResult>
    </Page>
  );
}
