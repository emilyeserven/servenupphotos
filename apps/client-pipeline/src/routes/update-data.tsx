import { Outlet, createFileRoute, useParams } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { UpdateDataNav } from "@/components/update-data/section-nav";

export const Route = createFileRoute("/update-data")({
  component: UpdateDataPage,
  staticData: { wide: true },
});

/** Bulk changes to the photo JSON on GitHub, one subpage each, picked from a side navigation. */
function UpdateDataPage() {
  const current = useParams({ strict: false, select: (params) => params.section });

  return (
    <Page
      title="Update Data"
      description="Bulk changes to every photo's JSON on GitHub. Each one previews what it will change, then saves it as one commit in the photo data pull request."
      wide
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <UpdateDataNav current={current} />
        <div className="flex min-w-0 max-w-3xl flex-1 flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </Page>
  );
}
