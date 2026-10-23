import { queryOptions } from "@tanstack/react-query";
import { type ErrorBody, apiErrorOf } from "@/api/errors";

/** All the client ever learns about a stored secret. */
export interface SecretStatus {
  set: boolean;
  last4?: string;
}

export interface SettingsResponse {
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: SecretStatus;
    bucket: string;
    publicUrl: string;
  };
  github: {
    repo: string;
    branch: string;
    folder: string;
    token: SecretStatus;
    /** Whether Commit puts untitled photos in ALLPHOTOS.json too; false keeps them as drafts. */
    includeUntitled: boolean;
  };
}

export type SettingsSection = keyof SettingsResponse;

/** Whether Settings has everything needed to list the bucket and show its images. */
export function r2IsSetUp(r2: SettingsResponse["r2"]): boolean {
  return [r2.accountId, r2.accessKeyId, r2.secretAccessKey.set, r2.bucket, r2.publicUrl].every(
    Boolean,
  );
}

/** Whether Settings has the GitHub repository and token the photo data needs. */
export function githubIsSetUp(settings: SettingsResponse | undefined): boolean {
  return Boolean(settings?.github.repo && settings.github.token.set);
}

/** The data folder from Settings, as the backend cleans it, defaulting to the portfolio's. */
export function dataFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "") || "apps/portfolio/src/data";
}

/** What to do with a stored secret on save: keep it (`undefined`), clear it (`""`), or replace it. */
export type SecretUpdate = string | undefined;

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!res.ok) throw apiErrorOf(url, res.status, json);
  return json as T;
}

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: () => requestJson<SettingsResponse>("/api/settings"),
});

/** The outcome of checking a section's settings against the service they connect to. */
export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export type SettingsBody = Record<string, string | boolean | undefined>;

export function saveSettings(section: SettingsSection, body: SettingsBody) {
  return requestJson<SettingsResponse>(`/api/settings/${section}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Checks unsaved settings; a kept (`undefined`) secret is filled in from the stored one. */
export function testSettings(section: SettingsSection, body: SettingsBody) {
  return requestJson<ConnectionTestResult>(`/api/settings/${section}/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
