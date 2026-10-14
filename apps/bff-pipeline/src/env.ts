import path from "node:path";

export const env = {
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 8080),
  /** Base URL of the Go backend (be-pipeline). */
  apiUrl: process.env.API_URL ?? "http://localhost:8081",
  /** Built client-pipeline assets. Served only when the directory exists (i.e. production). */
  clientDist:
    process.env.CLIENT_DIST ?? path.resolve(import.meta.dirname, "../../client-pipeline/dist"),
};
