import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { settingsQuery } from "@/api/settings";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { SiteSpotlight } from "@/components/site-spotlight";

export const Route = createFileRoute("/site-spotlight")({
  component: SiteSpotlightPage,
});

/** The album each spotlight zone of the portfolio shows, saved as each album's `spotlightZones`. */
function SiteSpotlightPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      wide
      title="Site Spotlight"
      description="Pick the album shown in each spotlight zone of the portfolio, such as behind the homepage."
    >
      <QueryResult query={settings}>
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <SiteSpotlight />
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
