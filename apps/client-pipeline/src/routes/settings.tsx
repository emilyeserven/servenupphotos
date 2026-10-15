import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  type ConnectionTestResult,
  type SecretStatus,
  type SecretUpdate,
  type SettingsBody,
  type SettingsResponse,
  type SettingsSection,
  saveSettings,
  settingsQuery,
  testSettings,
} from "@/api/settings";
import { Page } from "@/components/page";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

interface FieldConfig {
  name: string;
  label: string;
  placeholder?: string;
}

interface SectionConfig {
  section: SettingsSection;
  title: string;
  description: string;
  fields: FieldConfig[];
  secret: FieldConfig;
  /** Shown under the secret's label, given the form's current field values. */
  secretHelp?: (fields: Record<string, string>) => ReactNode;
  /** Checks the form's unsaved settings; when set, the card gets a Test connection button. */
  test?: (body: SettingsBody) => Promise<ConnectionTestResult>;
}

const SECTIONS: SectionConfig[] = [
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
    secretHelp: (fields) => <R2TokenHelp bucket={fields.bucket ?? ""} />,
    test: (body) => testSettings("r2", body),
  },
  {
    section: "github",
    title: "GitHub",
    description:
      "Repository, base branch and folder for photo JSON. Saves go to a pull request against the branch.",
    fields: [
      { name: "repo", label: "Repository", placeholder: "owner/name" },
      { name: "branch", label: "Branch", placeholder: "main" },
      { name: "folder", label: "Folder", placeholder: "apps/portfolio/src/data" },
    ],
    secret: { name: "token", label: "Personal access token" },
    secretHelp: (fields) => <GitHubTokenHelp repo={fields.repo ?? ""} />,
    test: (body) => testSettings("github", body),
  },
];

function SettingsPage() {
  const settings = useQuery(settingsQuery);

  return (
    <Page
      title="Settings"
      description="Connections the pipeline will use. Secrets are stored on the backend and can be replaced, but never read back."
    >
      <QueryResult query={settings}>
        {(data) =>
          SECTIONS.map((config) => (
            <SettingsCard key={config.section} config={config} stored={data[config.section]} />
          ))
        }
      </QueryResult>
    </Page>
  );
}

/** keep: leave the stored secret alone; replace: send a new one; clear: remove it. */
type SecretDraft = { action: "keep" } | { action: "replace"; value: string } | { action: "clear" };

interface FormValues {
  fields: Record<string, string>;
  secret: SecretDraft;
}

function toFormValues(
  config: SectionConfig,
  stored: SettingsResponse[SettingsSection],
): FormValues {
  const values = stored as unknown as Record<string, string>;
  return {
    fields: Object.fromEntries(config.fields.map(({ name }) => [name, values[name] ?? ""])),
    secret: { action: "keep" },
  };
}

function toSettingsBody(config: SectionConfig, value: FormValues): SettingsBody {
  return { ...value.fields, [config.secret.name]: toSecretUpdate(value.secret) };
}

function toSecretUpdate(draft: SecretDraft): SecretUpdate {
  if (draft.action === "replace") return draft.value;
  if (draft.action === "clear") return "";
  return undefined;
}

function validateSecret(draft: SecretDraft): string | undefined {
  if (draft.action === "replace" && draft.value === "") return "Enter a new value, or cancel.";
  return undefined;
}

interface SettingsCardProps {
  config: SectionConfig;
  stored: SettingsResponse[SettingsSection];
}

function SettingsCard({ config, stored }: SettingsCardProps) {
  const queryClient = useQueryClient();
  const secretStatus = (stored as unknown as Record<string, SecretStatus | undefined>)[
    config.secret.name
  ] ?? { set: false };

  const save = useMutation({
    mutationFn: (value: FormValues) => saveSettings(config.section, toSettingsBody(config, value)),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsQuery.queryKey, data);
      form.reset(toFormValues(config, data[config.section]));
    },
  });

  const test = useMutation({
    mutationFn: (value: FormValues) => config.test!(toSettingsBody(config, value)),
  });

  /** Any edit makes the last save or test result stale. */
  const clearResults = () => {
    save.reset();
    test.reset();
  };

  const form = useForm({
    defaultValues: toFormValues(config, stored),
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          {config.fields.map((field) => (
            <form.Field key={field.name} name={`fields.${field.name}`}>
              {(f) => (
                <TextField
                  id={`${config.section}-${field.name}`}
                  config={field}
                  value={f.state.value}
                  onBlur={f.handleBlur}
                  onChange={(value) => {
                    clearResults();
                    f.handleChange(value);
                  }}
                />
              )}
            </form.Field>
          ))}

          <form.Field name="secret" validators={{ onSubmit: ({ value }) => validateSecret(value) }}>
            {(f) => (
              <SecretField
                id={`${config.section}-${config.secret.name}`}
                label={config.secret.label}
                help={
                  config.secretHelp && (
                    <form.Subscribe selector={(state) => state.values.fields}>
                      {(fields) => config.secretHelp?.(fields)}
                    </form.Subscribe>
                  )
                }
                status={secretStatus}
                draft={f.state.value}
                error={f.state.meta.errors[0]}
                onChange={(draft) => {
                  clearResults();
                  f.handleChange(draft);
                }}
              />
            )}
          </form.Field>

          <div className="flex items-center gap-3">
            <form.Subscribe selector={(state) => state.canSubmit && state.isDirty}>
              {(canSubmit) => (
                <Button type="submit" disabled={!canSubmit || save.isPending}>
                  {save.isPending && <Spinner />}
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              )}
            </form.Subscribe>
            {config.test && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={test.isPending}
                  onClick={() => test.mutate(form.state.values)}
                >
                  Test connection
                </Button>
                <ConnectionStatus state={toTestState(test)} />
              </>
            )}
            <SaveStatus isSuccess={save.isSuccess} error={save.error} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SaveStatus({ isSuccess, error }: { isSuccess: boolean; error: Error | null }) {
  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (isSuccess) return <p className="text-muted-foreground text-sm">Saved.</p>;
  return null;
}

/** Where a connection test stands: running, finished, or not run since the last edit. */
type TestState = "pending" | ConnectionTestResult | undefined;

function toTestState({
  isPending,
  data,
  error,
}: {
  isPending: boolean;
  data: ConnectionTestResult | undefined;
  error: Error | null;
}): TestState {
  if (isPending) return "pending";
  if (error) return { ok: false, message: error.message };
  return data;
}

/** A spinner while a connection test runs, then a check or an X with the reason. */
function ConnectionStatus({ state }: { state: TestState }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm">
      {state === "pending" ? <Spinner aria-label="Testing connection" /> : null}
      {typeof state === "object" ? <ConnectionResult result={state} /> : null}
    </div>
  );
}

function ConnectionResult({ result }: { result: ConnectionTestResult }) {
  if (!result.ok) {
    return (
      <>
        <XIcon className="text-destructive size-4 shrink-0" aria-label="Connection failed" />
        <span className="text-destructive">{result.message}</span>
      </>
    );
  }
  return (
    <>
      <CheckIcon
        className="size-4 shrink-0 text-green-600 dark:text-green-400"
        aria-label="Connected"
      />
      <span className="text-muted-foreground">{result.message}</span>
    </>
  );
}

interface TextFieldProps {
  id: string;
  config: FieldConfig;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function TextField({ id, config, value, onChange, onBlur }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {config.label}
      </label>
      <Input
        id={id}
        value={value}
        placeholder={config.placeholder}
        autoComplete="off"
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

interface SecretFieldProps {
  id: string;
  label: string;
  help?: ReactNode;
  status: SecretStatus;
  draft: SecretDraft;
  error: string | undefined;
  onChange: (draft: SecretDraft) => void;
}

/** A write-only secret: shows whether one is stored, and lets you replace or clear it. */
function SecretField({ id, label, help, status, draft, error, onChange }: SecretFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {help}
      {draft.action === "replace" ? (
        <SecretInput
          id={id}
          value={draft.value}
          errorId={errorId}
          invalid={Boolean(error)}
          canCancel={status.set}
          onChange={onChange}
        />
      ) : (
        <SecretSummary
          id={id}
          status={status}
          clearing={draft.action === "clear"}
          onChange={onChange}
        />
      )}
      <p id={errorId} className="text-destructive text-sm empty:hidden">
        {error}
      </p>
    </div>
  );
}

interface SecretInputProps {
  id: string;
  value: string;
  errorId: string;
  invalid: boolean;
  canCancel: boolean;
  onChange: (draft: SecretDraft) => void;
}

function SecretInput({ id, value, errorId, invalid, canCancel, onChange }: SecretInputProps) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="password"
        autoComplete="new-password"
        autoFocus={canCancel}
        value={value}
        aria-invalid={invalid}
        aria-describedby={errorId}
        onChange={(event) => onChange({ action: "replace", value: event.target.value })}
      />
      {canCancel && (
        <Button type="button" variant="ghost" onClick={() => onChange({ action: "keep" })}>
          Cancel
        </Button>
      )}
    </div>
  );
}

interface SecretSummaryProps {
  id: string;
  status: SecretStatus;
  clearing: boolean;
  onChange: (draft: SecretDraft) => void;
}

function SecretSummary({ id, status, clearing, onChange }: SecretSummaryProps) {
  return (
    <div className="flex items-center gap-2">
      <p id={id} className="text-muted-foreground flex-1 font-mono text-sm">
        {describeSecret(status, clearing)}
      </p>
      <SecretActions isSet={status.set} clearing={clearing} onChange={onChange} />
    </div>
  );
}

interface SecretActionsProps {
  isSet: boolean;
  clearing: boolean;
  onChange: (draft: SecretDraft) => void;
}

function SecretActions({ isSet, clearing, onChange }: SecretActionsProps) {
  if (clearing) {
    return (
      <Button type="button" variant="ghost" onClick={() => onChange({ action: "keep" })}>
        Undo
      </Button>
    );
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange({ action: "replace", value: "" })}
      >
        {isSet ? "Replace" : "Set"}
      </Button>
      {isSet && (
        <Button type="button" variant="ghost" onClick={() => onChange({ action: "clear" })}>
          Clear
        </Button>
      )}
    </>
  );
}

function describeSecret(status: SecretStatus, clearing: boolean): string {
  if (clearing) return "Will be removed when you save";
  if (!status.set) return "Not set";
  return status.last4 ? `•••• ${status.last4}` : "••••••••";
}

/**
 * R2 token permissions, from Cloudflare's docs:
 * https://developers.cloudflare.com/r2/api/tokens/
 */
function R2TokenHelp({ bucket }: { bucket: string }) {
  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm">
      <p>
        In R2, open <strong>Manage API tokens</strong> and create a token with{" "}
        <strong>Object Read &amp; Write</strong>, applied only to{" "}
        {bucket.trim() || "your photo bucket"}. That lets the pipeline upload, list and download
        photos. Cloudflare shows the secret access key only once, so paste it here right away.
      </p>
      <ExternalLink href="https://dash.cloudflare.com/?to=/:account/r2/overview">
        Open R2 in the Cloudflare dashboard
      </ExternalLink>
    </div>
  );
}

/**
 * GitHub's token form, pre-filled via its URL template parameters:
 * https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#pre-filling-fine-grained-personal-access-token-details-using-url-parameters
 */
function githubTokenUrl(repo: string): string {
  const params = new URLSearchParams({
    name: "servenupphotos pipeline",
    description: "Opens pull requests with photo JSON from the servenupphotos pipeline.",
    contents: "write",
    pull_requests: "write",
  });
  const owner = repo.split("/")[0]?.trim();
  if (owner) params.set("target_name", owner);
  return `https://github.com/settings/personal-access-tokens/new?${params}`;
}

function GitHubTokenHelp({ repo }: { repo: string }) {
  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm">
      <p>
        Use a fine-grained token. Under <strong>Repository access</strong>, choose{" "}
        <strong>Only select repositories</strong> and pick {repo.trim() || "your photo repository"}.
        It needs <strong>Contents: Read and write</strong> and{" "}
        <strong>Pull requests: Read and write</strong>, and GitHub adds{" "}
        <strong>Metadata: Read-only</strong> automatically.
      </p>
      <div className="flex gap-4">
        <ExternalLink href={githubTokenUrl(repo)}>Create a token</ExternalLink>
        <ExternalLink href="https://github.com/settings/personal-access-tokens">
          Regenerate an existing one
        </ExternalLink>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-foreground inline-flex items-center gap-1 self-start underline underline-offset-4"
    >
      {children}
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}
