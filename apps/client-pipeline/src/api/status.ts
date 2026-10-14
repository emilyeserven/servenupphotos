import { queryOptions } from "@tanstack/react-query";

interface HealthResponse {
  status: "ok" | "degraded";
  bff: "ok";
  backend: "ok" | "unreachable";
}

interface HelloResponse {
  message: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return (await res.json()) as T;
}

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: () => getJson<HealthResponse>("/api/health"),
  refetchInterval: 10_000,
});

export const helloQuery = queryOptions({
  queryKey: ["hello"],
  queryFn: () => getJson<HelloResponse>("/api/hello"),
});
