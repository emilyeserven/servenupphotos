import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { socialCalendarQuery } from "@/api/publish";
import { settingsQuery } from "@/api/settings";
import { PlannedWalkthrough } from "@/components/instagram-planned/walkthrough";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";

export const Route = createFileRoute("/instagram-planned")({
  component: InstagramPlannedPage,
});

/** The planned Instagram posts, one at a time, to put on Instagram side by side with it. */
function InstagramPlannedPage() {
  const settings = useQuery(settingsQuery);
  return (
    <Page
      title="Planned Posts"
      description="Go through the photos planned for Instagram in order: download each original, copy its caption, and mark it Scheduled once it's on Instagram."
    >
      <QueryResult query={settings}>
        {(data) =>
          data.github.repo && data.github.token.set ? <PlannedPhotos /> : <SettingsFirst />
        }
      </QueryResult>
    </Page>
  );
}

/** The walkthrough, once the photo files are read. */
function PlannedPhotos() {
  const calendar = useQuery(socialCalendarQuery);
  return (
    <QueryResult query={calendar} pendingLabel="Reading the photo files…">
      {() => <PlannedWalkthrough />}
    </QueryResult>
  );
}

function SettingsFirst() {
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
