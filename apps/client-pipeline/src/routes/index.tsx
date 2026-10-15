import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { connectionQuery, connectionQueryKey, missingSettings } from "@/api/connections";
import { type SettingsResponse, type SettingsSection, settingsQuery } from "@/api/settings";
import { healthQuery, helloQuery } from "@/api/status";
import { ConnectionStatus, toTestState } from "@/components/connection-status";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: StatusPage,
});

function StatusPage() {
  const health = useQuery(healthQuery);
  const hello = useQuery(helloQuery);

  return (
    <Page
      title="Photo Pipeline"
      description="Local tool for preparing images and generating portfolio data."
    >
      <Card>
        <CardHeader>
          <CardTitle>Service status</CardTitle>
          <CardDescription>client → bff-pipeline (Fastify) → be-pipeline (Go)</CardDescription>
        </CardHeader>
        <CardContent>
          <QueryResult query={health} pendingLabel="Checking…">
            {(data) => (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">BFF</dt>
                <dd>{data.bff}</dd>
                <dt className="text-muted-foreground">Backend</dt>
                <dd>{data.backend}</dd>
              </dl>
            )}
          </QueryResult>
        </CardContent>
      </Card>

      <ConnectionsCard />

      <Card>
        <CardHeader>
          <CardTitle>Hello from Go</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryResult query={hello}>{(data) => <p>{data.message}</p>}</QueryResult>
        </CardContent>
      </Card>
    </Page>
  );
}

const CONNECTIONS: { section: SettingsSection; label: string }[] = [
  { section: "r2", label: "Cloudflare R2" },
  { section: "github", label: "GitHub" },
];

/** Checks the saved R2 and GitHub settings, the same way Settings' Test connection does. */
function ConnectionsCard() {
  const queryClient = useQueryClient();
  const settings = useQuery(settingsQuery);
  const checking = useIsFetching({ queryKey: connectionQueryKey() }) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connections</CardTitle>
        <CardDescription>Saved settings, checked against Cloudflare and GitHub.</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={checking || !settings.isSuccess}
            onClick={() => {
              void settings.refetch();
              void queryClient.invalidateQueries({ queryKey: connectionQueryKey() });
            }}
          >
            Recheck
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <QueryResult query={settings} pendingLabel="Loading settings…">
          {(data) => (
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm">
              {CONNECTIONS.map(({ section, label }) => (
                <ConnectionRow key={section} section={section} label={label} settings={data} />
              ))}
            </dl>
          )}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

interface ConnectionRowProps {
  section: SettingsSection;
  label: string;
  settings: SettingsResponse;
}

function ConnectionRow({ section, label, settings }: ConnectionRowProps) {
  const missing = missingSettings(section, settings);
  const check = useQuery({ ...connectionQuery(section, settings), enabled: missing.length === 0 });

  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        {missing.length > 0 ? (
          <p className="text-muted-foreground">
            Not set up: add the {missing.join(", ")} in{" "}
            <Link to="/settings" className="text-foreground underline underline-offset-4">
              Settings
            </Link>
            .
          </p>
        ) : (
          <ConnectionStatus
            state={toTestState({
              isPending: check.isFetching,
              data: check.data,
              error: check.error,
            })}
          />
        )}
      </dd>
    </>
  );
}
