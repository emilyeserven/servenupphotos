import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * R2 token permissions, from Cloudflare's docs:
 * https://developers.cloudflare.com/r2/api/tokens/
 */
export function R2TokenHelp({ bucket }: { bucket: string }) {
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
    actions: "read",
  });
  const owner = repo.split("/")[0]?.trim();
  if (owner) params.set("target_name", owner);
  return `https://github.com/settings/personal-access-tokens/new?${params}`;
}

/** How to make the fine-grained GitHub token the pipeline needs, with a link to GitHub's pre-filled form. */
export function GitHubTokenHelp({ repo }: { repo: string }) {
  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm">
      <p>
        Use a fine-grained token. Under <strong>Repository access</strong>, choose{" "}
        <strong>Only select repositories</strong> and pick {repo.trim() || "your photo repository"}.
        It needs <strong>Contents: Read and write</strong> and{" "}
        <strong>Pull requests: Read and write</strong>, and GitHub adds{" "}
        <strong>Metadata: Read-only</strong> automatically. That also covers committing
        ALLPHOTOS.json from the app.
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
