import { queryOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/request";

interface HealthResponse {
  status: "ok" | "degraded";
  bff: "ok";
  backend: "ok" | "unreachable";
}

interface HelloResponse {
  message: string;
}

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: () => requestJson<HealthResponse>("/api/health"),
  refetchInterval: 10_000,
});

export const helloQuery = queryOptions({
  queryKey: ["hello"],
  queryFn: () => requestJson<HelloResponse>("/api/hello"),
});
