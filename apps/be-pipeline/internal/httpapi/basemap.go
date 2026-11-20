package httpapi

import (
	"net/http"
	"os"
	"strings"
)

// basemapAnswer is what the pipeline's pages need to draw CARTO's basemap
// tiles themselves, such as under the Trip Lines page's day cards.
type basemapAnswer struct {
	// CartoKey is CARTO_KEY from the repo's .env: CARTO's raster tiles carry
	// an "API key required" watermark without one. "" when it isn't set, and
	// the pages then draw no basemap.
	CartoKey string `json:"cartoKey"`
}

// handleBasemap answers with the CARTO API key the pages fetch basemap tiles
// with. The pipeline only runs on the owner's own machine, so its pages can
// hold the key.
func handleBasemap() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, basemapAnswer{CartoKey: strings.TrimSpace(os.Getenv("CARTO_KEY"))})
	}
}
