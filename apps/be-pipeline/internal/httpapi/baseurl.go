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

// baseURLTimeout bounds a base URL preview or change, which reads every photo
// JSON file from GitHub.
const baseURLTimeout = 60 * time.Second

type baseURLRequest struct {
	// From is the base URL the image URLs start with now.
	From string `json:"from"`
	// To is the base URL they should start with instead.
	To string `json:"to"`
}

// handlePreviewBaseURL reports the origins of the image URLs in every photo
// JSON file and which of them changing the base URL in the body would rewrite,
// as the Update Data page previews a change.
func handlePreviewBaseURL(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBaseURL(store, func(ctx context.Context, cfg settings.GitHub, req baseURLRequest) (any, error) {
		return gh.PreviewBaseURL(ctx, cfg, req.From, req.To)
	})
}

// handleReplaceBaseURL rewrites the image URLs in every photo JSON file from
// one base URL to another, as one commit in the photo data pull request.
func handleReplaceBaseURL(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBaseURL(store, func(ctx context.Context, cfg settings.GitHub, req baseURLRequest) (any, error) {
		return gh.ReplaceBaseURL(ctx, cfg, req.From, req.To)
	})
}

func handleBaseURL(store *settings.Store, run func(context.Context, settings.GitHub, baseURLRequest) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req baseURLRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid base URL body")
			return
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), baseURLTimeout)
		defer cancel()
		result, err := run(ctx, cfg, req)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("change image base URL failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not change the image base URL")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}
