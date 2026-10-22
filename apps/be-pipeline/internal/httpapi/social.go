package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

type socialDatesRequest struct {
	Dates []github.SocialDate `json:"dates"`
}

// handleSocialCalendar lists every photo JSON file with its social media
// publish date, for the Instagram page's calendar. It only reads from GitHub.
func handleSocialCalendar(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), baseURLTimeout)
		defer cancel()
		result, err := gh.SocialCalendar(ctx, cfg)
		writeSocialResult(w, result, err, "could not read the photo files")
	}
}

// handleSetSocialDates sets the social media publish dates in the body, as
// one commit in the photo data pull request.
func handleSetSocialDates(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req socialDatesRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid publish dates body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), baseURLTimeout)
		defer cancel()
		result, err := gh.SetSocialDates(ctx, cfg, req.Dates)
		writeSocialResult(w, result, err, "could not save the publish dates")
	}
}

func githubSettings(w http.ResponseWriter, store *settings.Store) (settings.GitHub, bool) {
	cfg, err := store.GitHub()
	if err != nil {
		slog.Error("read settings failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not read settings")
		return settings.GitHub{}, false
	}
	return cfg, true
}

func writeSocialResult(w http.ResponseWriter, result any, err error, failure string) {
	var perr *github.PublishError
	if errors.As(err, &perr) {
		writeError(w, perr.Status, perr.Message)
		return
	}
	if err != nil {
		slog.Error(failure, "err", err)
		writeError(w, http.StatusInternalServerError, failure)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
