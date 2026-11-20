package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

type updateInFlightRequest struct {
	// Path is the photo JSON file's path in the repository.
	Path string `json:"path"`
	// Data is the file's new content, a JSON object.
	Data json.RawMessage `json:"data"`
	// Name, when set, is a new file name to move the file to in its folder.
	Name string `json:"name"`
}

// handleUpdateInFlight saves the body's data as the content of a photo JSON
// file in flight or already in the portfolio, as the Photo page saves an
// edit, renaming the file when the body has a new name. It's kept with the
// changes waiting for Commit, which commits it to the "Add photo data" pull
// request.
func handleUpdateInFlight(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "photo data", "Couldn't save the photo data.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, req updateInFlightRequest) (any, error) {
			if req.Path == "" {
				return nil, badRequest(pathMessage)
			}
			return gh.Update(ctx, cfg, req.Path, req.Name, req.Data)
		})
}
