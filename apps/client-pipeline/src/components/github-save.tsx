import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import type { SanitizedExif } from "@/api/exif";
import { type PublishResult, publishPhotoMutation } from "@/api/photos";
import { type SettingsResponse, settingsQuery } from "@/api/settings";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { jsonFileName } from "@/lib/file-name";

type GitHubSettings = SettingsResponse["github"];

/** Matches the backend's rule: plain file names only. */
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function validateName(name: string): string | undefined {
  const stem = name.trim().replace(/\.json$/, "");
  if (!FILE_NAME_PATTERN.test(stem)) {
    return "Use letters, numbers, dots, dashes and underscores, starting with a letter or number.";
  }
  return undefined;
}

function jsonPath(folder: string, name: string): string {
  const dir = folder.trim().replace(/^\/+|\/+$/g, "");
  const file = `${name.trim().replace(/\.json$/, "")}.json`;
  return dir ? `${dir}/${file}` : file;
}

interface GitHubSaveCardProps {
  file: string;
  sanitized: SanitizedExif;
  /** Called once the JSON file is saved. */
  onSaved?: () => void;
}

/** Saves a photo's sanitized EXIF as JSON in a pull request on the GitHub repository from Settings. */
export function GitHubSaveCard({ file, sanitized, onSaved }: GitHubSaveCardProps) {
  const settings = useQuery(settingsQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Save to GitHub</CardTitle>
        <CardDescription>
          Adds the sanitized EXIF as one JSON file to the open photo data pull request, or opens a
          new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={settings}>
          {(data) =>
            data.github.repo && data.github.token.set ? (
              <GitHubSaveForm
                github={data.github}
                file={file}
                sanitized={sanitized}
                onSaved={onSaved}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Set the GitHub repository and token in{" "}
                <Link to="/settings" className="text-foreground underline underline-offset-4">
                  Settings
                </Link>{" "}
                first.
              </p>
            )
          }
        </QueryResult>
      </CardContent>
    </Card>
  );
}

function GitHubSaveForm({
  github,
  file,
  sanitized,
  onSaved,
}: GitHubSaveCardProps & { github: GitHubSettings }) {
  const publish = useMutation({ ...publishPhotoMutation, onSuccess: () => onSaved?.() });
  const suggestedName = jsonFileName(sanitized.title, file);

  const form = useForm({
    defaultValues: { name: suggestedName },
    validators: { onSubmit: ({ value }) => validateName(value.name) },
    onSubmit: async ({ value }) => {
      await publish.mutateAsync({ name: value.name.trim(), file, sanitized }).catch(() => {});
    },
  });

  // The name follows the title until it's typed in by hand.
  useEffect(() => {
    if (form.getFieldMeta("name")?.isDirty) return;
    form.setFieldValue("name", suggestedName, { dontUpdateMeta: true });
  }, [form, suggestedName]);

  if (publish.isSuccess) return <PublishSuccess result={publish.data} repo={github.repo} />;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name" validators={{ onChange: ({ value }) => validateName(value) }}>
        {(field) => {
          const error = field.state.meta.errors[0];
          return (
            <div className="flex flex-col gap-2">
              <label htmlFor={field.name} className="text-sm font-medium">
                File name
              </label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                disabled={publish.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={`${field.name}-hint`}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  publish.reset();
                  field.handleChange(event.target.value);
                }}
              />
              <p id={`${field.name}-hint`} className="text-muted-foreground text-sm">
                {error ? (
                  <span className="text-destructive">{error}</span>
                ) : (
                  <>
                    Saves <code>{jsonPath(github.folder, field.state.value)}</code> in {github.repo}
                    , in a pull request against {github.branch.trim() || "the default branch"}.
                  </>
                )}
              </p>
            </div>
          );
        }}
      </form.Field>

      {publish.isError && <p className="text-destructive text-sm">{publish.error.message}</p>}

      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <Button type="submit" className="self-start" disabled={!canSubmit || publish.isPending}>
            {publish.isPending && <Spinner />}
            {publish.isPending ? "Saving…" : "Save to GitHub"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function PublishSuccess({ result, repo }: { result: PublishResult; repo: string }) {
  const pr = `${repo}#${result.pullRequestNumber}`;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Saved{" "}
        <a
          href={result.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {result.path}
        </a>{" "}
        {result.newPullRequest ? "and opened" : "to the open pull request"}{" "}
        <a
          href={result.pullRequestUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {pr}
        </a>
        .
      </p>
    </div>
  );
}
