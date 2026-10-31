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
			writePublishError(w, perr)
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

// handleCreateGroup saves a new album, tag or genre, by the path's kind
// ("albums", "tags" or "genres"), as JSON in the photo data pull request.
func handleCreateGroup(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		kind, ok := github.KindByFolder(r.PathValue("kind"))
		if !ok {
			writeError(w, http.StatusNotFound, "kind must be albums, tags or genres")
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
			writePublishError(w, perr)
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

// handleSetGroupParent moves the path's album or tag under the body's parent
// of the same kind, or to the top level when it's empty or null, as a change
// waiting for Commit.
func handleSetGroupParent(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		kind, ok := github.KindByFolder(r.PathValue("kind"))
		if !ok || !github.HasParents(kind) {
			writeError(w, http.StatusNotFound, "only albums and tags have a parent")
			return
		}
		var req struct {
			Parent *string `json:"parent"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid parent body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetGroupParent(ctx, cfg, kind, r.PathValue("id"), *cmp.Or(req.Parent, new(string)))
		writeSocialResult(w, result, err, "could not save the parent")
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

// handleSetAlbumOrder gives each album in the body's ids its place there, 1
// first, as a change waiting for Commit.
func handleSetAlbumOrder(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			IDs []string `json:"ids"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid album order body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetAlbumOrder(ctx, cfg, req.IDs)
		writeSocialResult(w, result, err, "could not save the albums' order")
	}
}

// handleSetAlbumPhotoOrder saves the body's photoIds, photo IDs in the order
// the portfolio shows them, as the path's album's photo order, a change
// waiting for Commit. An empty list puts its photos back in the default order.
func handleSetAlbumPhotoOrder(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PhotoIDs []int `json:"photoIds"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid photo order body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetAlbumPhotoOrder(ctx, cfg, r.PathValue("id"), req.PhotoIDs)
		writeSocialResult(w, result, err, "could not save the album's photo order")
	}
}

// maxAlbumLayoutBytes is the largest album layout body read, room for
// many rows of Markdown text; the BFF's own limit is the same 1 MiB.
const maxAlbumLayoutBytes = 1 << 20

// handleSetAlbumLayout saves the body's covers and layout, the album's cover
// photos and its rows of photos with Markdown text above and below each, as
// the path's album's, a change waiting for Commit.
func handleSetAlbumLayout(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req github.AlbumLayout
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxAlbumLayoutBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid album layout body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetAlbumLayout(ctx, cfg, r.PathValue("id"), req)
		writeSocialResult(w, result, err, "could not save the album's layout")
	}
}

// handleNormalizeTagNames names every tag in lowercase kebab-case, its ID, as
// changes waiting for Commit.
func handleNormalizeTagNames(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.NormalizeTagNames(ctx, cfg)
		writeSocialResult(w, result, err, "could not rename the tags")
	}
}

// handleSetTagDescriptions saves the body's descriptions, by tag ID, as those
// tags' descriptions, as changes waiting for Commit.
func handleSetTagDescriptions(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Descriptions map[string]string `json:"descriptions"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil || len(req.Descriptions) == 0 {
			writeError(w, http.StatusBadRequest, "invalid tag descriptions body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetTagDescriptions(ctx, cfg, req.Descriptions)
		writeSocialResult(w, result, err, "could not save the tag descriptions")
	}
}

// handleSetSpotlightAlbum makes the body's album the one the path's spotlight
// spot shows, or leaves the spot without one when it's empty or null, as a
// change waiting for Commit.
func handleSetSpotlightAlbum(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Album *string `json:"album"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid spotlight album body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetSpotlightAlbum(ctx, cfg, r.PathValue("zone"), *cmp.Or(req.Album, new(string)))
		writeSocialResult(w, result, err, "could not save the spot's album")
	}
}

// handleSetAlbumHidden saves whether the portfolio hides the path's album,
// from the body's hidden, as a change waiting for Commit.
func handleSetAlbumHidden(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Hidden *bool `json:"hidden"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil || req.Hidden == nil {
			writeError(w, http.StatusBadRequest, "invalid album visibility body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetAlbumHidden(ctx, cfg, r.PathValue("id"), *req.Hidden)
		writeSocialResult(w, result, err, "could not save the album's visibility")
	}
}
