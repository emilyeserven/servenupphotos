package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/areas"
)

// areaFinder looks up areas and their outlines (see areas.New).
type areaFinder interface {
	Find(ctx context.Context, query string) ([]areas.Area, error)
}

// areaTimeout is how long one look-up may take, waiting its turn included.
const areaTimeout = 28 * time.Second

// handleFindAreas answers the areas with an outline matching ?q=: a name,
// such as "Osaka Castle Park", or a Wikidata item ID, such as Q1490.
func handleFindAreas(finder areaFinder) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q == "" || len(q) > 200 {
			writeError(w, http.StatusBadRequest, "Give the area's name, or its Wikidata ID such as Q1490.")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), areaTimeout)
		defer cancel()
		found, err := finder.Find(ctx, q)
		if errors.Is(err, areas.ErrNoRelation) {
			writeError(w, http.StatusNotFound, "That Wikidata item has no OpenStreetMap relation (P402), so there's no outline to use. Try its name instead.")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadGateway, "Couldn't look up the area on OpenStreetMap: "+err.Error())
			return
		}
		writeJSON(w, http.StatusOK, found)
	}
}
