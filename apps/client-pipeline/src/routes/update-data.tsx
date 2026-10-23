import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { r2IsSetUp, settingsQuery } from "@/api/settings";
import { ImageBaseUrlCard } from "@/components/image-base-url";
import { MissingFieldsCard } from "@/components/missing-fields";
import { ReapplyOverridesCard } from "@/components/reapply-overrides";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";

export const Route = createFileRoute("/update-data")({
  component: UpdateDataPage,
});

/** Bulk changes to the photo JSON on GitHub, one card each. */
function UpdateDataPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      title="Update Data"
      description="Bulk changes to every photo's JSON on GitHub. Each one previews what it will change, then saves it as one commit in the photo data pull request."
    >
      <QueryResult query={settings}>
        {(data) =>
          data.github.repo && data.github.token.set ? (
            <>
              <ImageBaseUrlCard publicUrl={data.r2.publicUrl} />
              <MissingFieldsCard canReadExif={r2IsSetUp(data.r2)} />
              <ReapplyOverridesCard />
            </>
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
