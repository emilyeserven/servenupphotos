import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";

export const Route = createFileRoute("/site-spotlight")({
  component: SiteSpotlightPage,
});

/** Stub: the photos with a `websiteSpotlight` place, in the order the site spotlights them. */
function SiteSpotlightPage() {
  return (
    <Page
      title="Site Spotlight"
      description="The photos spotlighted on the portfolio site, in the order they're shown."
    >
      <p className="text-muted-foreground text-sm">Coming soon.</p>
    </Page>
  );
}
