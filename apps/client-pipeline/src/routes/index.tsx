import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { healthQuery, helloQuery } from "@/api/status";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
