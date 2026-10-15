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

export function saveSettings(section: SettingsSection, body: Record<string, string | undefined>) {
  return requestJson<SettingsResponse>(`/api/settings/${section}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
