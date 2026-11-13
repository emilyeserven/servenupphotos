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

/** A failed request to the pipeline's API, with GitHub's answer when a GitHub call failed. */
class ApiError extends Error {
  /** The pipeline's HTTP status. */
  readonly status: number;
  /** GitHub's answer, when a GitHub call is what failed. */
  readonly github?: GitHubFailure;
  /** A free file name to offer instead, when the one asked for is taken. */
  readonly suggestedName?: string;

  constructor(message: string, status: number, github?: GitHubFailure, suggestedName?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.github = github;
    this.suggestedName = suggestedName;
  }
}

/** The body of a failed request: the message to show and, when a GitHub call failed, its answer. */
export interface ErrorBody {
  message?: string;
  github?: GitHubFailure;
  /** A free file name to offer instead, when the one asked for is taken. */
  suggestedName?: string;
}

/** The error for a failed request to url, from its status and body. */
export function apiErrorOf(url: string, status: number, body: ErrorBody | null): ApiError {
  const message = body?.message ?? `${url} responded ${status}`;
  return new ApiError(message, status, body?.github, body?.suggestedName);
}

/** GitHub's answer carried by error, when it's an ApiError from a failed GitHub call. */
export function githubFailureOf(error: unknown): GitHubFailure | undefined {
  return error instanceof ApiError ? error.github : undefined;
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
