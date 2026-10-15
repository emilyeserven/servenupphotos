import { queryOptions } from "@tanstack/react-query";

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
  };
}

export type SettingsSection = keyof SettingsResponse;

/** What to do with a stored secret on save: keep it (`undefined`), clear it (`""`), or replace it. */
export type SecretUpdate = string | undefined;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok) throw new Error(json?.message ?? `${url} responded ${res.status}`);
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

export type SettingsBody = Record<string, string | undefined>;

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
