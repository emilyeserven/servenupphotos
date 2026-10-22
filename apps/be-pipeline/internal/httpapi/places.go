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
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.Entries(ctx, cfg)
		writeSocialResult(w, result, err, "could not read places and localizations")
	}
}

// handleSavePlace saves the body as the path's place, new or replacing the
// one there, as one commit in the photo data pull request.
func handleSavePlace(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var place github.Place
		if !decodeEntry(w, r, &place, "place") {
			return
		}
		place.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SavePlace(ctx, cfg, place)
		writeSocialResult(w, result, err, "could not save the place")
	}
}

// handleSaveLocalization saves the body as the path's localization, new or
// replacing the one there, as one commit in the photo data pull request.
func handleSaveLocalization(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var localization github.Localization
		if !decodeEntry(w, r, &localization, "localization") {
			return
		}
		localization.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveLocalization(ctx, cfg, localization)
		writeSocialResult(w, result, err, "could not save the localization")
	}
}

// decodeEntry reads the request's JSON body into out, writing an error and
// returning false when it isn't a kind with only known fields.
func decodeEntry(w http.ResponseWriter, r *http.Request, out any, kind string) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		writeError(w, http.StatusBadRequest, "invalid "+kind+" body")
		return false
	}
	return true
}
