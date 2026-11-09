import type { ReactNode } from "react";
import {
  type ConnectionTestResult,
  type SettingsBody,
  type SettingsSection,
  testSettings,
} from "@/api/settings";
import { GitHubTokenHelp, R2TokenHelp } from "@/components/settings/token-help";
import { type SwitchConfig } from "@/components/settings-switch";

/** One text setting on a Settings card. */
export interface FieldConfig {
  name: string;
  label: string;
  placeholder?: string;
}

/** One Settings card: its fields, its write-only secret and its on-or-off settings. */
export interface SectionConfig {
  section: SettingsSection;
  title: string;
  description: string;
  fields: FieldConfig[];
  secret: FieldConfig;
  /** On-or-off settings, shown after the fields. */
  switches: SwitchConfig[];
  /** Shown under the secret's label, given the form's current field values. */
  secretHelp?: (fields: Record<string, string>) => ReactNode;
  /** Checks the form's unsaved settings; when set, the card gets a Test connection button. */
  test?: (body: SettingsBody) => Promise<ConnectionTestResult>;
}

/** The Settings page's cards, in order: Cloudflare R2, then GitHub. */
export const SECTIONS: SectionConfig[] = [
  {
    section: "r2",
    title: "Cloudflare R2",
    description: "Bucket that cropped and resized photos are uploaded to.",
    fields: [
      { name: "accountId", label: "Account ID" },
      { name: "accessKeyId", label: "Access key ID" },
      { name: "bucket", label: "Bucket", placeholder: "photos" },
      { name: "publicUrl", label: "Public URL", placeholder: "https://photos.example.com" },
    ],
    secret: { name: "secretAccessKey", label: "Secret access key" },
    switches: [],
    secretHelp: (fields) => <R2TokenHelp bucket={fields.bucket ?? ""} />,
    test: (body) => testSettings("r2", body),
  },
  {
    section: "github",
    title: "GitHub",
    description:
      "Repository, base branch and data folder. Photo, album and tag JSON go in its photos, albums and tags folders, saved to a pull request against the branch.",
    fields: [
      { name: "repo", label: "Repository", placeholder: "owner/name" },
      { name: "branch", label: "Branch", placeholder: "main" },
      { name: "folder", label: "Data folder", placeholder: "apps/portfolio/src/data" },
    ],
    secret: { name: "token", label: "Personal access token" },
    switches: [
      {
        name: "includeUntitled",
        label: "Keep untitled photos as drafts",
        help: (
          <>
            A photo without a title keeps its JSON file, but Commit leaves it out of{" "}
            <code>ALLPHOTOS.json</code>, so the portfolio doesn&apos;t show it until it gets one.
            Turn this off to put every photo in <code>ALLPHOTOS.json</code>, named by its file when
            it has no title.
          </>
        ),
        inverted: true,
      },
    ],
    secretHelp: (fields) => <GitHubTokenHelp repo={fields.repo ?? ""} />,
    test: (body) => testSettings("github", body),
  },
];
