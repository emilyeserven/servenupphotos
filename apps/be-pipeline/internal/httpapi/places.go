package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleEntries lists every place and localization file at the open photo
// data pull request's head, or on the base branch, without changing anything.
func handleEntries(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not read places and localizations", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.Entries(ctx, cfg)
	})
}

// handleSavePlace saves the body as the path's place, new or replacing the
// one there, as one commit in the photo data pull request.
func handleSavePlace(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "place", "could not save the place",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, place github.Place) (any, error) {
			place.ID = r.PathValue("id")
			return gh.SavePlace(ctx, cfg, place)
		})
}

// handleSaveLocalization saves the body as the path's localization, new or
// replacing the one there, as one commit in the photo data pull request.
func handleSaveLocalization(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "localization", "could not save the localization",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, localization github.Localization) (any, error) {
			localization.ID = r.PathValue("id")
			return gh.SaveLocalization(ctx, cfg, localization)
		})
}

// decodeEntry reads the request's JSON body into out, writing an error and
// returning false when it isn't a kind with only known fields.
func decodeEntry(w http.ResponseWriter, r *http.Request, out any, kind string) bool {
	return decodeEntryUpTo(w, r, out, kind, maxPhotoDataBytes)
}

// decodeEntryUpTo is decodeEntry for a body of up to limit bytes.
func decodeEntryUpTo(w http.ResponseWriter, r *http.Request, out any, kind string, limit int64) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		writeError(w, http.StatusBadRequest, "invalid "+kind+" body")
		return false
	}
	return true
}
