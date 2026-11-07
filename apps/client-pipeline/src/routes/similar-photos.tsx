import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { FindSimilarCard } from "@/components/similar-photos/find-similar-card";
import { PickSimilarCard } from "@/components/similar-photos/pick-similar-card";
import { WithGitHub } from "@/components/update-data/sections-layout";

export const Route = createFileRoute("/similar-photos")({
  component: SimilarPhotosPage,
});

/** The Similar Photos page, under Publish in the sidebar: what the portfolio's More like this drawer shows. */
function SimilarPhotosPage() {
  return (
    <Page
      title="Similar Photos"
      description="Chooses the photos the portfolio's More like this drawer shows for each photo."
    >
      <WithGitHub
        render={() => (
          <div className="flex flex-col gap-6">
            <FindSimilarCard />
            <PickSimilarCard />
          </div>
        )}
      />
    </Page>
  );
}
