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
		cfg, ok := githubSettings(w, store)
		if !ok {
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
		if !decodeEntry(w, r, &group, kind.Name) {
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
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
		if !decodeEntry(w, r, &req, "parent") {
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SetGroupParent(ctx, cfg, kind, r.PathValue("id"), *cmp.Or(req.Parent, new(string)))
		writeResult(w, result, err, "could not save the parent")
	}
}

// handleAddPhotoGroups adds the body's albums and tags to the body's photo
// files, as one commit in the photo data pull request.
func handleAddPhotoGroups(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, baseURLTimeout, "albums and tags", "could not save the albums and tags",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, req github.PhotoGroups) (any, error) {
			return gh.AddPhotoGroups(ctx, cfg, req)
		})
}

// idsBody is the body of a request about a list of albums or tags: their IDs.
type idsBody struct {
	IDs []string `json:"ids"`
}

// handleSetAlbumOrder gives each album in the body's ids its place there, 1
// first, as a change waiting for Commit.
func handleSetAlbumOrder(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "album order", "could not save the albums' order",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, req idsBody) (any, error) {
			return gh.SetAlbumOrder(ctx, cfg, req.IDs)
		})
}

// handleSetAlbumPhotoOrder saves the body's photoIds, photo IDs in the order
// the portfolio shows them, as the path's album's photo order, a change
// waiting for Commit. An empty list puts its photos back in the default order.
func handleSetAlbumPhotoOrder(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "photo order", "could not save the album's photo order",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, req albumPhotosBody) (any, error) {
			return gh.SetAlbumPhotoOrder(ctx, cfg, r.PathValue("id"), req.PhotoIDs)
		})
}

// maxAlbumLayoutBytes is the largest album layout body read, room for
// many rows of Markdown text; the BFF's own limit is the same 1 MiB.
const maxAlbumLayoutBytes = 1 << 20

// handleSetAlbumLayout saves the body's covers and layout, the album's cover
// photos and its rows of photos with Markdown text above and below each, as
// the path's album's, a change waiting for Commit.
func handleSetAlbumLayout(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBodyUpTo(store, publishTimeout, "album layout", maxAlbumLayoutBytes, "could not save the album's layout",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, req github.AlbumLayout) (any, error) {
			return gh.SetAlbumLayout(ctx, cfg, r.PathValue("id"), req)
		})
}

// handleNormalizeTagNames names every tag in lowercase kebab-case, its ID, as
// changes waiting for Commit.
func handleNormalizeTagNames(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not rename the tags", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.NormalizeTagNames(ctx, cfg)
	})
}

// tagDescriptionsBody is the body of a tag descriptions save: each
// description by tag ID.
type tagDescriptionsBody struct {
	Descriptions map[string]string `json:"descriptions"`
}

// handleSetTagDescriptions saves the body's descriptions, by tag ID, as those
// tags' descriptions, as changes waiting for Commit.
func handleSetTagDescriptions(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "tag descriptions", "could not save the tag descriptions",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, req tagDescriptionsBody) (any, error) {
			if len(req.Descriptions) == 0 {
				return nil, badRequest("invalid tag descriptions body")
			}
			return gh.SetTagDescriptions(ctx, cfg, req.Descriptions)
		})
}

// tagFavoritesBody is the body of a favorite tags save: whether each tag, by
// ID, is a favorite.
type tagFavoritesBody struct {
	Favorites map[string]bool `json:"favorites"`
}

// handleSetTagFavorites saves whether each tag in the body's favorites, by
// tag ID, is a favorite tag, as changes waiting for Commit.
func handleSetTagFavorites(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "favorite tags", "could not save the favorite tags",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, req tagFavoritesBody) (any, error) {
			if len(req.Favorites) == 0 {
				return nil, badRequest("invalid favorite tags body")
			}
			return gh.SetTagFavorites(ctx, cfg, req.Favorites)
		})
}

// spotlightAlbumBody is the body of a spotlight spot save: the album it
// shows, or none, and its orientation.
type spotlightAlbumBody struct {
	Album       *string `json:"album"`
	Orientation string  `json:"orientation"`
}

// handleSetSpotlightAlbum makes the body's album the one the path's spotlight
// spot shows, or leaves the spot without one when it's empty or null, with
// the body's orientation ("screen", "none", or missing to keep the spot's),
// as a change waiting for Commit.
func handleSetSpotlightAlbum(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "spotlight album", "could not save the spot's album",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, req spotlightAlbumBody) (any, error) {
			return gh.SetSpotlightAlbum(ctx, cfg, r.PathValue("zone"), *cmp.Or(req.Album, new(string)), req.Orientation)
		})
}

// albumHiddenBody is the body of an album visibility save: whether the
// portfolio hides the album.
type albumHiddenBody struct {
	Hidden *bool `json:"hidden"`
}

// handleSetAlbumHidden saves whether the portfolio hides the path's album,
// from the body's hidden, as a change waiting for Commit.
func handleSetAlbumHidden(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "album visibility", "could not save the album's visibility",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, req albumHiddenBody) (any, error) {
			if req.Hidden == nil {
				return nil, badRequest("invalid album visibility body")
			}
			return gh.SetAlbumHidden(ctx, cfg, r.PathValue("id"), *req.Hidden)
		})
}

// albumRulesBody is the body of a Smart Album rules save: the rules, or none.
type albumRulesBody struct {
	Rules map[string]json.RawMessage `json:"rules"`
}

// handleSetAlbumRules saves the body's rules as the path's album's Smart
// Album rules, or makes it an album of chosen photos again when they're
// empty or null, as a change waiting for Commit.
func handleSetAlbumRules(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "Smart Album rules", "could not save the Smart Album's rules",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, req albumRulesBody) (any, error) {
			return gh.SetAlbumRules(ctx, cfg, r.PathValue("id"), req.Rules)
		})
}
