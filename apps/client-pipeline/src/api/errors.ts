/**
 * What GitHub answered to a call that failed, as the backend passes it on: which step of the work
 * it was, the request, the status, GitHub's message and its list of errors.
 */
export interface GitHubFailure {
  /** What the call was for, such as "saving the changed files". */
  step: string;
  method: string;
  /** The request's path, such as `/repos/owner/name/git/trees`. */
  path: string;
  /** GitHub's HTTP status, such as 422. */
  status: number;
  /** GitHub's message, such as "Validation Failed". */
  message?: string;
  /** GitHub's list of what failed validation, as GitHub sent it. */
  errors?: unknown[];
  /** The GitHub docs page GitHub pointed to. */
  documentationUrl?: string;
  /** GitHub's X-GitHub-Request-Id, which GitHub support asks for. */
  requestId?: string;
  /** The start of GitHub's answer, when it wasn't JSON. */
  body?: string;
}

/**
 * What Cloudflare answered to an R2 request that failed, as the backend passes it on, so a failure
 * its plain-language reason doesn't explain can be looked up.
 */
export interface CloudflareResponse {
  /** HTTP status, missing when no response arrived. */
  status?: number;
  /** The S3 error code and message, as listed in https://developers.cloudflare.com/r2/api/error-codes/ */
  code?: string;
  message?: string;
  requestId?: string;
  /** Cloudflare's CF-Ray ID for the answer, which Cloudflare support asks for. */
  ray?: string;
  /** The S3 call that failed, such as "HeadObject". */
  operation?: string;
  /** The request's method and path, bucket then key, such as "HEAD /photos/photos/abc-name-thumbnail.webp". */
  request?: string;
  /** How many times the backend sent the request before giving up, when it asked again. */
  attempts?: number;
  /** The whole error, as the backend's S3 client reported it. */
  error: string;
}

/** A failed request to the pipeline's API, with GitHub's answer when a GitHub call failed. */
class ApiError extends Error {
  /** The pipeline's HTTP status. */
  readonly status: number;
  /** The pipeline request that failed, such as `/api/photos/bucket/thumbnail-crop?key=…`. */
  readonly url: string;
  /** GitHub's answer, when a GitHub call is what failed. */
  readonly github?: GitHubFailure;
  /** Cloudflare's answer, when an R2 request is what failed. */
  readonly cloudflare?: CloudflareResponse;
  /** A free file name to offer instead, when the one asked for is taken. */
  readonly suggestedName?: string;
  /** Whether it failed only because a map it needs is still downloading, so asking again works. */
  readonly loading: boolean;

  constructor(message: string, url: string, status: number, body: ErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.url = url;
    this.status = status;
    this.github = body?.github;
    this.cloudflare = body?.cloudflare;
    this.suggestedName = body?.suggestedName;
    this.loading = body?.loading === true;
  }
}

/** The body of a failed request: the message to show and, when a GitHub call failed, its answer. */
export interface ErrorBody {
  message?: string;
  github?: GitHubFailure;
  /** When an R2 request failed, what Cloudflare answered. */
  cloudflare?: CloudflareResponse;
  /** A free file name to offer instead, when the one asked for is taken. */
  suggestedName?: string;
  /** True when a rail or bus map the look-up needs is still downloading or being read. */
  loading?: boolean;
}

/** The error for a failed request to url, from its status and body. */
export function apiErrorOf(url: string, status: number, body: ErrorBody | null): ApiError {
  const message = body?.message ?? `${url} responded ${status}`;
  return new ApiError(message, url, status, body);
}

/**
 * Whether error is a transit look-up that stopped waiting for a rail or bus map still downloading
 * or being read, which goes on without it, so the same look-up can simply be asked again.
 */
export function isMapLoading(error: unknown): boolean {
  return error instanceof ApiError && error.loading;
}

/** GitHub's answer carried by error, when it's an ApiError from a failed GitHub call. */
export function githubFailureOf(error: unknown): GitHubFailure | undefined {
  return error instanceof ApiError ? error.github : undefined;
}

/**
 * Cloudflare's answer carried by error, from an ApiError or an UploadError whose R2 request failed,
 * with the pipeline request it answered when that's known; undefined for any other failure.
 */
export function cloudflareFailureOf(
  error: unknown,
): { response: CloudflareResponse; pipeline?: string } | undefined {
  if (error instanceof ApiError) {
    return (
      error.cloudflare && {
        response: error.cloudflare,
        pipeline: `${error.status} from ${error.url}`,
      }
    );
  }
  if (error instanceof Error && "cloudflare" in error && isCloudflareResponse(error.cloudflare)) {
    return { response: error.cloudflare };
  }
  return undefined;
}

function isCloudflareResponse(value: unknown): value is CloudflareResponse {
  return typeof value === "object" && value !== null && "error" in value;
}

/**
 * The free name the backend offers when a save or upload stopped because its name is taken, from
 * an ApiError or an UploadError; undefined for any other failure.
 */
export function suggestedNameOf(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    "suggestedName" in error &&
    typeof error.suggestedName === "string"
  ) {
    return error.suggestedName || undefined;
  }
  return undefined;
}
