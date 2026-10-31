import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { settingsQuery } from "@/api/settings";
import { QueryResult } from "@/components/query-result";
import { updateDataSections } from "@/components/update-data/sections";

export const Route = createFileRoute("/update-data/$section")({
  component: UpdateDataSectionPage,
});

/** One Update Data subpage: its card, once GitHub is set up. */
function UpdateDataSectionPage() {
  const { section: slug } = Route.useParams();
  const settings = useQuery(settingsQuery);
  const section = updateDataSections.find((s) => s.slug === slug);
  if (!section) {
    return (
      <p className="text-muted-foreground text-sm">There's no Update Data page called “{slug}”.</p>
    );
  }

  return (
    <QueryResult query={settings}>
      {(data) =>
        data.github.repo && data.github.token.set ? section.render(data) : <SetUpGitHub />
      }
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
