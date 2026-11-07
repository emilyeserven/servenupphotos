import { createFileRoute } from "@tanstack/react-router";
import { UploadQueueCard } from "@/components/bulk-upload/upload-queue-card";
import { BulkUploadCard } from "@/components/dashboard/bulk-upload-card";
import { CompareCard } from "@/components/dashboard/compare-card";
import { DraftsCard } from "@/components/dashboard/drafts-card";
import { InstagramCard } from "@/components/dashboard/instagram-card";
import { NeedsAttentionCard } from "@/components/dashboard/needs-attention-card";
import { NextUpAlbumsCard } from "@/components/dashboard/next-up-albums-card";
import { SiteSpotlightCard } from "@/components/dashboard/site-spotlight-card";
import { fixedCrumbs } from "@/components/sidebar/route-crumbs";
import { Page } from "@/components/page";
import { useCompareGroups } from "@/hooks/use-compare-groups";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  staticData: { crumbs: fixedCrumbs("Dashboard") },
});

/** The pipeline's home page: what to work on next, at a glance. */
function DashboardPage() {
  const compare = useCompareGroups();
  return (
    <Page title="Dashboard" description="What to work on next across the pipeline." wide>
      <UploadQueueCard />
      <NeedsAttentionCard />
      {/* Two columns that stack on their own, so a short card doesn't leave a gap beside a tall one. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <NextUpAlbumsCard />
          <DraftsCard compare={compare} />
          <InstagramCard />
        </div>
        <div className="flex flex-col gap-6">
          <BulkUploadCard />
          <CompareCard compare={compare} />
          <SiteSpotlightCard />
        </div>
      </div>
    </Page>
  );
}
