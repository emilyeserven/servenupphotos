import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";

export const Route = createFileRoute("/instagram")({
  component: InstagramPage,
});

/** Stub: the photos marked `isSocialMediaEligible`, to post to Instagram. */
function InstagramPage() {
  return (
    <Page
      title="Instagram"
      description="Photos marked as eligible for social media, ready to post to Instagram."
    >
      <p className="text-muted-foreground text-sm">Coming soon.</p>
    </Page>
  );
}
