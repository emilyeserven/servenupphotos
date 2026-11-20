package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

type publishedResponse struct {
	github.PublishedResult
	Images inFlightImages `json:"images"`
}

// handlePublishedPhotos lists the photo JSON on the base branch of the GitHub
// repository from Settings, the photos already in the portfolio, with each
// photo's image in R2, without changing anything.
func handlePublishedPhotos(store *settings.Store, gh *github.Client, findPhotos findPhotosFunc) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't read the published photos.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		result, err := gh.Published(ctx, cfg)
		if err != nil {
			return nil, err
		}
		files := make([]github.InFlightFile, len(result.Files))
		for i, f := range result.Files {
			files[i] = f.InFlightFile
		}
		images, err := findImages(r.Context(), store, findPhotos, files)
		if err != nil {
			return nil, settingsFailed(err)
		}
		return publishedResponse{PublishedResult: result, Images: images}, nil
	})
}
