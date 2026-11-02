import { createFileRoute } from "@tanstack/react-router";
import { CompareGroupList } from "@/components/compare/compare-group-list";
import { CompareGroupView } from "@/components/compare/compare-group-view";
import { Page } from "@/components/page";
import { useCompareGroups } from "@/hooks/use-compare-groups";

interface CompareSearch {
  /** The compare group shown head-to-head; every group is listed when left out. */
  group?: string;
}

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): CompareSearch =>
    typeof search.group === "string" && search.group ? { group: search.group } : {},
});

function ComparePage() {
  const { group } = Route.useSearch();
  const compare = useCompareGroups();
  return (
    <Page
      wide
      title={group ?? "Compare"}
      description="Photos from the Gallery and Photos in Flight weighed head-to-head, to decide which one gets posted. Only the pipeline shows these groups."
    >
      {group ? (
        <CompareGroupView name={group} compare={compare} />
      ) : (
        <CompareGroupList compare={compare} />
      )}
    </Page>
  );
}
