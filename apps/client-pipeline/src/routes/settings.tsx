import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { settingsQuery } from "@/api/settings";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { SECTIONS } from "@/components/settings/sections";
import { SettingsCard } from "@/components/settings/settings-card";
import { ChromeExtensionCard } from "@/components/settings/chrome-extension-card";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      title="Settings"
      description="Connections the pipeline will use. Secrets are stored on the backend and can be replaced, but never read back."
    >
      <QueryResult query={settings}>
        {(data) =>
          SECTIONS.map((config) => (
            <SettingsCard key={config.section} config={config} stored={data[config.section]} />
          ))
        }
      </QueryResult>
      <ChromeExtensionCard />
    </Page>
  );
}
