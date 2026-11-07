package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/transit"
)

// transitFinder looks up the transit lines OpenStreetMap maps (see
// transit.New): the ones near two spots, and one's track between them.
type transitFinder interface {
	Lines(ctx context.Context, mode string, from, to [2]float64) ([]transit.Line, error)
	Track(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error)
	Stops(ctx context.Context, id int64) ([]transit.Stop, error)
}

// transitTimeout is how long one look-up may take, waiting its turn and trying
// the mirrors included.
// It fits one full try on each of the three default servers.
const transitTimeout = 85 * time.Second

// trackAnswer is a transit line's track between two spots.
type trackAnswer struct {
	// Path is the track, each point [longitude, latitude].
	Path [][2]float64 `json:"path"`
}

// handleTransitLines answers the lines of ?mode= ("train", "subway", "bus"
// or "transit") whose track passes near both ?from= and ?to=, each
// "longitude,latitude".
func handleTransitLines(finder transitFinder) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, to, ok := spotsParam(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), transitTimeout)
		defer cancel()
		lines, err := finder.Lines(ctx, r.URL.Query().Get("mode"), from, to)
		if errors.Is(err, transit.ErrNoKind) {
			writeError(w, http.StatusBadRequest, "Only a train, subway, bus or transit hop rides a line.")
			return
		}
		if err != nil {
			writeOverpassError(w, "look up lines", err)
			return
		}
		writeJSON(w, http.StatusOK, lines)
	}
}

// handleTransitStops answers line {id}'s stations or stops, in the order it
// runs.
func handleTransitStops(finder transitFinder) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := lineID(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), transitTimeout)
		defer cancel()
		stops, err := finder.Stops(ctx, id)
		if err != nil {
			writeOverpassError(w, "get the line's stops", err)
			return
		}
		writeJSON(w, http.StatusOK, stops)
	}
}

// lineID reads the path's {id}, writing an error when it isn't a line's ID.
func lineID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "Give the line's OpenStreetMap ID.")
		return 0, false
	}
	return id, true
}

// handleTransitTrack answers line {id}'s track between ?from= and ?to=.
func handleTransitTrack(finder transitFinder) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := lineID(w, r)
		if !ok {
			return
		}
		from, to, ok := spotsParam(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), transitTimeout)
		defer cancel()
		path, err := finder.Track(ctx, id, from, to)
		writeTrack(w, path, err)
	}
}

// writeTrack answers path, or the error that kept it from being found.
func writeTrack(w http.ResponseWriter, path [][2]float64, err error) {
	switch {
	case errors.Is(err, transit.ErrNoTrack):
		writeError(w, http.StatusUnprocessableEntity, "That line's mapped track doesn't join those two spots. Try another line or direction.")
	case err != nil:
		writeOverpassError(w, "get the line's track", err)
	default:
		writeJSON(w, http.StatusOK, trackAnswer{Path: path})
	}
}

// writeOverpassError answers a failed look-up of what, such as "look up
// lines". When every server was busy it says so and asks to try again later,
// since that's the servers' load and not the photos.
func writeOverpassError(w http.ResponseWriter, what string, err error) {
	var busy *transit.BusyError
	if errors.As(err, &busy) {
		writeError(w, http.StatusServiceUnavailable, fmt.Sprintf(
			"OpenStreetMap's line servers are busy right now, so we couldn't %s (tried %d times on %d servers; the last, %s, %s). Try again in a minute.",
			what, busy.Tries, busy.Servers, busy.Server, statusOf(busy.Last)))
		return
	}
	writeError(w, http.StatusBadGateway, "Couldn't "+what+" on OpenStreetMap: "+err.Error())
}

// statusOf is a server's failure in a few words, such as "answered 502 Bad
// Gateway" or "took too long to answer".
func statusOf(err error) string {
	var status *transit.StatusError
	if errors.As(err, &status) {
		return "answered " + status.Status
	}
	if errors.Is(err, transit.ErrSlow) {
		return "took too long to answer"
	}
	return "failed: " + err.Error()
}

// spotsParam reads ?from= and ?to=, writing an error when either isn't a spot.
func spotsParam(w http.ResponseWriter, r *http.Request) (from, to [2]float64, ok bool) {
	q := r.URL.Query()
	from, okFrom := parseSpot(q.Get("from"))
	to, okTo := parseSpot(q.Get("to"))
	if !okFrom || !okTo {
		writeError(w, http.StatusBadRequest, "Give from and to as longitude,latitude.")
		return from, to, false
	}
	return from, to, true
}

// parseSpot reads "longitude,latitude", false when it isn't a spot on the globe.
func parseSpot(s string) ([2]float64, bool) {
	lng, lat, found := strings.Cut(s, ",")
	x, errX := strconv.ParseFloat(strings.TrimSpace(lng), 64)
	y, errY := strconv.ParseFloat(strings.TrimSpace(lat), 64)
	if !found || errX != nil || errY != nil || x < -180 || x > 180 || y < -90 || y > 90 {
		return [2]float64{}, false
	}
	return [2]float64{x, y}, true
}
