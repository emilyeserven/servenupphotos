import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  type BaseUrlChange,
  type BaseUrlPreview,
  type BaseUrlResult,
  baseUrlPreviewQuery,
  replaceBaseUrlMutation,
} from "@/api/data";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  CommitSuccess,
  PreviewDestination,
  Unreadable,
  count,
} from "@/components/update-data-shared";

/** Trims a base URL and its trailing slashes, as the backend does. */
function cleanBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** Matches the backend's rule: an http or https URL with a host, and nothing after its path. */
function isBaseUrl(cleaned: string): boolean {
  if (!URL.canParse(cleaned) || /[?#]/.test(cleaned)) return false;
  return ["http:", "https:"].includes(new URL(cleaned).protocol);
}

function validateBaseUrl(value: string): string | undefined {
  const cleaned = cleanBaseUrl(value);
  if (!cleaned) return "Enter a base URL.";
  if (isBaseUrl(cleaned)) return undefined;
  return "Use an http or https URL without a query string, such as https://photos.example.com.";
}

function validateChange({ from, to }: BaseUrlChange): string | undefined {
  if (cleanBaseUrl(from) !== cleanBaseUrl(to)) return undefined;
  return "The new base URL is the same as the current one.";
}

/** Starts from the most used origin, moving to the R2 Public URL when it's another one. */
function defaultChange(scan: BaseUrlPreview, publicUrl: string): BaseUrlChange {
  const from = scan.origins[0]?.origin ?? "";
  const to = cleanBaseUrl(publicUrl);
  return { from, to: to === from ? "" : to };
}

interface ImageBaseUrlCardProps {
  /** The R2 Public URL from Settings, which new uploads' URLs start with. */
  publicUrl: string;
}

/** Moves every image URL in the photo JSON from one base URL to another. */
export function ImageBaseUrlCard({ publicUrl }: ImageBaseUrlCardProps) {
  const scan = useQuery(baseUrlPreviewQuery({ from: "", to: "" }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image base URL</CardTitle>
        <CardDescription>
          Moves every image URL in the photo JSON (the original, each resized version, the preview,
          the Square Thumbnail and its preview) to another base URL, such as from R2&apos;s public
          development URL to a custom domain. The rest of each URL, query string included, stays the
          same, and the images in R2 aren&apos;t touched.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={scan} pendingLabel="Reading the photo JSON…">
          {(data) => <BaseUrlForm scan={data} publicUrl={publicUrl} />}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

interface BaseUrlFormProps {
  /** A preview without a change, for the origins the image URLs use now. */
  scan: BaseUrlPreview;
  publicUrl: string;
}

function BaseUrlForm({ scan, publicUrl }: BaseUrlFormProps) {
  const queryClient = useQueryClient();
  const [previewed, setPreviewed] = useState<BaseUrlChange | null>(null);
  const replace = useMutation({
    ...replaceBaseUrlMutation,
    onSuccess: () => {
      setPreviewed(null);
      // The photo JSON changed, so every preview and in-flight read is stale.
      void queryClient.invalidateQueries({ queryKey: ["data"] });
      void queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });

  const form = useForm({
    defaultValues: defaultChange(scan, publicUrl),
    validators: { onSubmit: ({ value }) => validateChange(value) },
    onSubmit: ({ value }) => {
      replace.reset();
      setPreviewed({ from: cleanBaseUrl(value.from), to: cleanBaseUrl(value.to) });
    },
  });

  /** Any edit makes the preview and the last result stale. */
  const clearResults = () => {
    setPreviewed(null);
    replace.reset();
  };

  return (
    <div className="flex flex-col gap-6">
      <Origins
        scan={scan}
        onPick={(origin) => {
          clearResults();
          form.setFieldValue("from", origin);
        }}
      />

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="from" validators={{ onSubmit: ({ value }) => validateBaseUrl(value) }}>
          {(field) => (
            <UrlField
              id="base-url-from"
              label="Current base URL"
              placeholder="https://pub-1234.r2.dev"
              value={field.state.value}
              error={field.state.meta.errors[0]}
              disabled={replace.isPending}
              onBlur={field.handleBlur}
              onChange={(value) => {
                clearResults();
                field.handleChange(value);
              }}
            />
          )}
        </form.Field>

        <form.Field name="to" validators={{ onSubmit: ({ value }) => validateBaseUrl(value) }}>
          {(field) => (
            <UrlField
              id="base-url-to"
              label="New base URL"
              placeholder="https://photos.example.com"
              value={field.state.value}
              error={field.state.meta.errors[0]}
              disabled={replace.isPending}
              hint={<PublicUrlHint publicUrl={publicUrl} to={field.state.value} />}
              onBlur={field.handleBlur}
              onChange={(value) => {
                clearResults();
                field.handleChange(value);
              }}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(error) => (error ? <p className="text-destructive text-sm">{String(error)}</p> : null)}
        </form.Subscribe>

        <Button type="submit" variant="outline" className="self-start" disabled={replace.isPending}>
          Preview changes
        </Button>
      </form>

      {previewed && (
        <PreviewResult
          change={previewed}
          pending={replace.isPending}
          error={replace.error}
          onApply={() => replace.mutate(previewed)}
        />
      )}
      {replace.isSuccess && <ReplaceSuccess result={replace.data} />}
    </div>
  );
}

/** The origins the image URLs use now, each with a button to pick it as the current base URL. */
function Origins({ scan, onPick }: { scan: BaseUrlPreview; onPick: (origin: string) => void }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">
        {count(scan.photoFiles, "photo file")} in <code>{scan.folder}</code> on{" "}
        <code>{scan.branch}</code>
        {scan.origins.length > 0 ? " have image URLs at:" : " have no image URLs yet."}
      </p>
      {scan.origins.length > 0 && (
        <ul className="flex flex-col gap-1">
          {scan.origins.map((o) => (
            <li key={o.origin} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <code className="break-all">{o.origin}</code>
              <span className="text-muted-foreground">
                {count(o.urls, "URL")} in {count(o.files, "file")}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => onPick(o.origin)}>
                Use as current
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Unreadable files={scan.unreadable} />
    </div>
  );
}

/** Says whether the new base URL matches the R2 Public URL in Settings, which new uploads use. */
function PublicUrlHint({ publicUrl, to }: { publicUrl: string; to: string }) {
  if (!publicUrl.trim()) return null;
  if (cleanBaseUrl(publicUrl) === cleanBaseUrl(to)) {
    return <>Matches the R2 Public URL in Settings, which new uploads use.</>;
  }
  return (
    <>
      New uploads use the R2 Public URL in Settings, <code>{cleanBaseUrl(publicUrl)}</code>. Change
      it there too, so new photos get the new base URL.
    </>
  );
}

interface UrlFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  error: string | undefined;
  disabled: boolean;
  hint?: ReactNode;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function UrlField(props: UrlFieldProps) {
  const { id, label, placeholder, value, error, disabled, hint, onChange, onBlur } = props;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={hintId}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={hintId} className="text-muted-foreground text-sm empty:hidden">
        {error ? <span className="text-destructive">{error}</span> : hint}
      </p>
    </div>
  );
}

interface PreviewResultProps {
  change: BaseUrlChange;
  pending: boolean;
  error: Error | null;
  onApply: () => void;
}

/** What the change would do, with the button that makes it. */
function PreviewResult({ change, pending, error, onApply }: PreviewResultProps) {
  const preview = useQuery(baseUrlPreviewQuery(change));

  return (
    <section aria-label="Preview" className="flex flex-col gap-4 border-t pt-6">
      <QueryResult query={preview} pendingLabel="Reading the photo JSON…">
        {(data) => <PreviewBody preview={data} pending={pending} error={error} onApply={onApply} />}
      </QueryResult>
    </section>
  );
}

function PreviewBody({
  preview,
  pending,
  error,
  onApply,
}: Omit<PreviewResultProps, "change"> & { preview: BaseUrlPreview }) {
  return (
    <>
      <PreviewSummary preview={preview} />
      <Unreadable files={preview.unreadable} blocking />
      {preview.files.length > 0 && <ChangedFiles files={preview.files} />}
      {preview.urls > 0 && (
        <ApplyChange preview={preview} pending={pending} error={error} onApply={onApply} />
      )}
    </>
  );
}

/** The button that makes the change, held back while a photo file can't be read. */
function ApplyChange({
  preview,
  pending,
  error,
  onApply,
}: Omit<PreviewResultProps, "change"> & { preview: BaseUrlPreview }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={preview.unreadable.length > 0 || pending} onClick={onApply}>
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          `Change ${count(preview.urls, "URL")}`
        )}
      </Button>
      {error && <p className="text-destructive text-sm">{error.message}</p>}
    </div>
  );
}

function PreviewSummary({ preview }: { preview: BaseUrlPreview }) {
  if (preview.urls === 0) {
    return (
      <p className="text-sm">
        No image URLs start with <code className="break-all">{preview.from}</code>, so there&apos;s
        nothing to change.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        <strong>{count(preview.urls, "URL")}</strong> in {preview.files.length} of{" "}
        {count(preview.photoFiles, "photo file")} will move from{" "}
        <code className="break-all">{preview.from}</code> to{" "}
        <code className="break-all">{preview.to}</code>.
      </p>
      <p className="text-muted-foreground">
        <PreviewDestination scan={preview} />
      </p>
    </div>
  );
}

/** Each changed file, collapsed to its name and count, with its URLs before and after inside. */
function ChangedFiles({ files }: { files: BaseUrlPreview["files"] }) {
  return (
    <ul className="flex flex-col divide-y rounded-md border text-sm">
      {files.map((file) => (
        <li key={file.path}>
          <details className="group">
            <summary className="hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-3 px-3 py-2">
              <code className="min-w-0 truncate">{file.path.split("/").pop()}</code>
              <span className="text-muted-foreground shrink-0">
                {count(file.changes.length, "URL")}
              </span>
            </summary>
            <dl className="flex flex-col gap-3 px-3 pt-1 pb-3">
              {file.changes.map((c) => (
                <div key={c.field} className="flex flex-col gap-0.5">
                  <dt className="font-medium">{c.field}</dt>
                  <dd className="text-muted-foreground font-mono text-xs break-all line-through">
                    {c.from}
                  </dd>
                  <dd className="font-mono text-xs break-all">{c.to}</dd>
                </div>
              ))}
            </dl>
          </details>
        </li>
      ))}
    </ul>
  );
}

function ReplaceSuccess({ result }: { result: BaseUrlResult }) {
  return (
    <CommitSuccess result={result}>
      Moved {count(result.urls, "URL")} in {count(result.files, "file")}
    </CommitSuccess>
  );
}
