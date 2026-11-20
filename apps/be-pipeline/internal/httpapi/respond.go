package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
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

// settingsMessage is the answer when the pipeline's settings file can't be
// read.
const settingsMessage = "Couldn't read the pipeline's settings. Open Settings, check them and save them again."

// loadSettings reads one part of the settings with load, such as
// store.GitHub or store.R2, answering that they couldn't be read and
// returning false when they can't.
func loadSettings[C any](w http.ResponseWriter, load func() (C, error)) (C, bool) {
	cfg, err := load()
	if err != nil {
		slog.Error("read settings failed", "err", err)
		writeError(w, http.StatusInternalServerError, settingsMessage)
		var zero C
		return zero, false
	}
	return cfg, true
}

// settingsFailed is the PublishError for a githubCall that couldn't read
// another part of the settings, such as the R2 settings, with err logged.
func settingsFailed(err error) *github.PublishError {
	slog.Error("read settings failed", "err", err)
	return &github.PublishError{Status: http.StatusInternalServerError, Message: settingsMessage}
}

// settingsCall is what a handler does once it has its settings, a C: it
// answers the request itself.
type settingsCall[C any] func(ctx context.Context, w http.ResponseWriter, r *http.Request, cfg C)

// withSettings is a handler that needs one part of the settings, read with
// load (such as store.R2), but not the photo data on GitHub. It reads them,
// answering when it can't, and gives do the request and a context that gives
// up after timeout. do answers the request, usually with writeR2Result.
// Handlers that read or change photo data use withGitHub instead.
func withSettings[C any](load func() (C, error), timeout time.Duration, do settingsCall[C]) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := loadSettings(w, load)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		do(ctx, w, r, cfg)
	}
}

// bodyCall is what a handler does with its JSON body, a T, once it is read.
type bodyCall[T any] func(w http.ResponseWriter, r *http.Request, body T)

// withBody is a handler whose JSON body is a T of up to limit bytes, read as
// decodeEntryUpTo reads it before do is called. Wrap withSettings in it when
// the handler needs settings too: the body is read first.
func withBody[T any](kind string, limit int64, do bodyCall[T]) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body T
		if !decodeEntryUpTo(w, r, &body, kind, limit) {
			return
		}
		do(w, r, body)
	}
}

// optionalBody lets h, which reads a JSON object body, take a request with
// none, as an empty object.
func optionalBody(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength == 0 {
			r.Body = io.NopCloser(strings.NewReader("{}"))
		}
		h(w, r)
	}
}

// decodeEntryUpTo reads the request's JSON body of up to limit bytes into
// out, writing an error and returning false when it isn't a kind with only
// known fields. It is the one place a handler reads a JSON body: a lint rule
// keeps json.NewDecoder out of the rest of the package.
func decodeEntryUpTo(w http.ResponseWriter, r *http.Request, out any, kind string, limit int64) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		// The reason names what's wrong, such as `json: unknown field "noGps"`.
		writeError(w, http.StatusBadRequest, "Couldn't read the "+kind+" sent with the request ("+err.Error()+"). Reload the page and try again.")
		return false
	}
	return true
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
		slog.Error("request failed", "message", failure, "err", err)
		writeError(w, http.StatusInternalServerError, failure)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// writeR2Result answers a call to R2: result when it went well, an
// UploadError as its own status and message with what Cloudflare answered,
// and any other error as failure, logged with the error and answered as a
// server error.
func writeR2Result(w http.ResponseWriter, result any, err error, failure string) {
	var uploadErr *storage.UploadError
	switch {
	case errors.As(err, &uploadErr):
		writeJSON(w, uploadErrorStatus(uploadErr), uploadErrorResponse{
			Message:       uploadErr.Message,
			SameName:      uploadErr.SameName,
			SuggestedName: uploadErr.SuggestedName,
			Cloudflare:    uploadErr.Cloudflare,
		})
	case err != nil:
		slog.Error("request failed", "message", failure, "err", err)
		writeError(w, http.StatusInternalServerError, failure)
	default:
		writeJSON(w, http.StatusOK, result)
	}
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
	return withSettings(store.GitHub, timeout, func(ctx context.Context, w http.ResponseWriter, r *http.Request, cfg settings.GitHub) {
		result, err := do(ctx, r, cfg)
		writeResult(w, result, err, failure)
	})
}

// githubBodyCall is a githubCall for a request whose JSON body, a T, was
// read first.
type githubBodyCall[T any] func(ctx context.Context, r *http.Request, cfg settings.GitHub, body T) (any, error)

// withGitHubBody is withGitHub for a request whose JSON body is a T, read
// before the settings as withBody reads it: a kind with only known
// fields, up to maxPhotoDataBytes, answered as an invalid kind body
// otherwise.
func withGitHubBody[T any](store *settings.Store, timeout time.Duration, kind, failure string, do githubBodyCall[T]) http.HandlerFunc {
	return withGitHubBodyUpTo(store, timeout, kind, maxPhotoDataBytes, failure, do)
}

// withGitHubBodyUpTo is withGitHubBody for a body of up to limit bytes.
func withGitHubBodyUpTo[T any](store *settings.Store, timeout time.Duration, kind string, limit int64, failure string, do githubBodyCall[T]) http.HandlerFunc {
	return withBody(kind, limit, func(w http.ResponseWriter, r *http.Request, body T) {
		withGitHub(store, timeout, failure, func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
			return do(ctx, r, cfg, body)
		})(w, r)
	})
}
