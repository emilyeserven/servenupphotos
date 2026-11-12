package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// writePublishError responds with perr's message and, when a GitHub call
// failed, GitHub's own answer, so the page can show what went wrong.
func writePublishError(w http.ResponseWriter, perr *github.PublishError) {
	if perr.GitHub != nil {
		slog.Warn("github call failed", "step", perr.GitHub.Step, "method", perr.GitHub.Method, "path", perr.GitHub.Path,
			"status", perr.GitHub.Status, "message", perr.GitHub.Message, "requestId", perr.GitHub.RequestID)
	}
	writeJSON(w, perr.Status, publishErrorBody{Message: perr.Message, GitHub: perr.GitHub, SuggestedName: perr.SuggestedName})
}

// publishErrorBody is the answer to a request that failed with a
// PublishError.
type publishErrorBody struct {
	Message string          `json:"message"`
	GitHub  *github.Failure `json:"github,omitempty"`
	// SuggestedName is a free file name to offer when the one asked for is
	// taken.
	SuggestedName string `json:"suggestedName,omitempty"`
}

// githubSettings reads the GitHub settings for a handler, answering that they
// couldn't be read and returning false when they can't.
func githubSettings(w http.ResponseWriter, store *settings.Store) (settings.GitHub, bool) {
	cfg, err := store.GitHub()
	if err != nil {
		slog.Error("read settings failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not read settings")
		return settings.GitHub{}, false
	}
	return cfg, true
}

// writeResult answers a GitHub-backed call: result when it went well, a
// PublishError as its own status and message, and any other error as failure,
// logged with the error and answered as a server error.
func writeResult(w http.ResponseWriter, result any, err error, failure string) {
	var perr *github.PublishError
	if errors.As(err, &perr) {
		writePublishError(w, perr)
		return
	}
	if err != nil {
		slog.Error(failure, "err", err)
		writeError(w, http.StatusInternalServerError, failure)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// badRequest is a PublishError for a request that can't be done as sent,
// for a handler's do func to return before it calls GitHub.
func badRequest(message string) *github.PublishError {
	return &github.PublishError{Status: http.StatusBadRequest, Message: message}
}

// githubCall is what a GitHub-backed handler does once it has its settings:
// usually one call to the github package, with the path's values from r.
type githubCall func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error)

// withGitHub is a handler that reads or changes photo data on GitHub. It
// reads the GitHub settings, gives do the request and a context that gives
// up after timeout, and answers what do returns with writeResult, so the
// handler itself is only its call to the github package.
func withGitHub(store *settings.Store, timeout time.Duration, failure string, do githubCall) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		result, err := do(ctx, r, cfg)
		writeResult(w, result, err, failure)
	}
}

// githubBodyCall is a githubCall for a request whose JSON body, a T, was
// read first.
type githubBodyCall[T any] func(ctx context.Context, r *http.Request, cfg settings.GitHub, body T) (any, error)

// withGitHubBody is withGitHub for a request whose JSON body is a T, read
// before the settings as decodeEntry reads it: a kind with only known
// fields, up to maxPhotoDataBytes, answered as an invalid kind body
// otherwise.
func withGitHubBody[T any](store *settings.Store, timeout time.Duration, kind, failure string, do githubBodyCall[T]) http.HandlerFunc {
	return withGitHubBodyUpTo(store, timeout, kind, maxPhotoDataBytes, failure, do)
}

// withGitHubBodyUpTo is withGitHubBody for a body of up to limit bytes.
func withGitHubBodyUpTo[T any](store *settings.Store, timeout time.Duration, kind string, limit int64, failure string, do githubBodyCall[T]) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body T
		if !decodeEntryUpTo(w, r, &body, kind, limit) {
			return
		}
		withGitHub(store, timeout, failure, func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
			return do(ctx, r, cfg, body)
		})(w, r)
	}
}
