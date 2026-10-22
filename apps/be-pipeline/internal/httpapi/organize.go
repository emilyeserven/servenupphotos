package httpapi

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleOrganize lists the albums and tags on GitHub, on the base branch and
// in the open photo data pull request, without changing anything.
func handleOrganize(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.Organize(ctx, cfg)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("read albums and tags failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read albums and tags")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// handleCreateGroup saves a new album or tag, by the path's kind ("albums" or
// "tags"), as JSON in the photo data pull request.
func handleCreateGroup(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		kind, ok := github.KindByFolder(r.PathValue("kind"))
		if !ok {
			writeError(w, http.StatusNotFound, "kind must be albums or tags")
			return
		}
		var group github.NewGroup
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&group); err != nil {
			writeError(w, http.StatusBadRequest, "invalid "+kind.Name+" body")
			return
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.CreateGroup(ctx, cfg, kind, group)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("create "+kind.Name+" failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not save the "+kind.Name)
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// handleSetAlbumParent moves the path's album into the body's parent album,
// or to the top level when it's empty or null, as one commit in the photo
// data pull request.
func handleSetAlbumParent(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Parent *string `json:"parent"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid album parent body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetAlbumParent(ctx, cfg, r.PathValue("id"), *cmp.Or(req.Parent, new(string)))
		writeSocialResult(w, result, err, "could not save the album's parent")
	}
}

// handleAddPhotoGroups adds the body's albums and tags to the body's photo
// files, as one commit in the photo data pull request.
func handleAddPhotoGroups(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req github.PhotoGroups
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid albums and tags body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), baseURLTimeout)
		defer cancel()
		result, err := gh.AddPhotoGroups(ctx, cfg, req)
		writeSocialResult(w, result, err, "could not save the albums and tags")
	}
}
