import { queryOptions } from "@tanstack/react-query";
import {
  type SettingsBody,
  type SettingsResponse,
  type SettingsSection,
  testSettings,
} from "@/api/settings";

export const connectionQueryKey = (section?: SettingsSection) =>
  section ? ["connection", section] : ["connection"];

/**
 * Checks a section's saved settings against the service they connect to. Each check
 * calls Cloudflare or GitHub, so it runs on demand rather than on a poll.
 */
export function connectionQuery(section: SettingsSection, settings: SettingsResponse) {
  return queryOptions({
    queryKey: connectionQueryKey(section),
    queryFn: () => testSettings(section, savedBody(settings[section])),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** The saved non-secret fields; leaving the secret out makes the backend use the stored one. */
function savedBody(stored: SettingsResponse[SettingsSection]): SettingsBody {
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** Names the settings a section needs that aren't filled in yet. */
export function missingSettings(section: SettingsSection, settings: SettingsResponse): string[] {
  const { r2, github } = settings;
  const fields: [string, boolean][] =
    section === "r2"
      ? [
          ["account ID", r2.accountId.trim() !== ""],
          ["access key ID", r2.accessKeyId.trim() !== ""],
          ["secret access key", r2.secretAccessKey.set],
          ["bucket", r2.bucket.trim() !== ""],
          ["public URL", r2.publicUrl.trim() !== ""],
        ]
      : [
          ["repository", github.repo.trim() !== ""],
          ["personal access token", github.token.set],
        ];
  return fields.filter(([, set]) => !set).map(([name]) => name);
}
