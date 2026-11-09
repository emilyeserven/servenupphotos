package transit

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// DefaultPhotonURL is the public Photon server (https://photon.komoot.io), a
// search-as-you-type service over OpenStreetMap's data, run by komoot. It
// answers a name search in well under a second, where Overpass runs a whole
// database query, but can only filter by one tag, so a train search there
// can't leave out subway stations. PHOTON_URL points it at another server.
const DefaultPhotonURL = "https://photon.komoot.io/api/"

// photonTimeout is how long Photon gets to answer.
const photonTimeout = 15 * time.Second

// photonTags are, for each mode, the OpenStreetMap "key:value" tags its
// stations are found by on Photon, any of which may match
// (https://github.com/komoot/photon#filter-results-by-tags-and-keys).
var photonTags = map[string][]string{
	"train":  {"railway:station", "railway:halt"},
	"subway": {"railway:station"},
	"bus":    {"highway:bus_stop", "amenity:bus_station"},
	"ferry":  {"amenity:ferry_terminal"},
}

// bboxDeg is how far, in degrees, Photon looks either side of the spot given:
// about 30 km, as Overpass does.
const bboxDeg = 0.3

// photonAnswer is the part of Photon's GeoJSON answer a station is read from.
type photonAnswer struct {
	Features []struct {
		Geometry struct {
			// Coordinates are [longitude, latitude].
			Coordinates [2]float64 `json:"coordinates"`
		} `json:"geometry"`
		Properties struct {
			Name string `json:"name"`
		} `json:"properties"`
	} `json:"features"`
}

// PhotonError is Photon not answering, or answering other than 200 OK.
type PhotonError struct {
	// Err is what went wrong, such as a timeout or "503 Service Unavailable".
	Err error
}

// Error says that Photon didn't answer and why.
func (e *PhotonError) Error() string {
	return "Photon (photon.komoot.io) didn't answer: " + e.Err.Error()
}

// Unwrap is what went wrong.
func (e *PhotonError) Unwrap() error { return e.Err }

// photonURL is PHOTON_URL, or else DefaultPhotonURL.
func photonURL() string {
	if u := strings.TrimSpace(os.Getenv("PHOTON_URL")); u != "" {
		return u
	}
	return DefaultPhotonURL
}

// PhotonStations are mode's stations or stops named like name within about
// 30 km of near ([longitude, latitude]), in the order Photon ranks them (best
// match, then nearest), each name once, with English names where mapped.
func (c *Client) PhotonStations(ctx context.Context, mode, name string, near [2]float64) ([]Station, error) {
	tags, ok := photonTags[mode]
	if !ok {
		return nil, ErrNoKind
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNoName
	}
	answer, err := c.askPhoton(ctx, photonQuery(tags, name, near))
	if err != nil {
		return nil, &PhotonError{Err: err}
	}
	return photonStations(answer, near), nil
}

// photonQuery is the query string for a Photon search for name near near,
// kept to tags and a box about 30 km around it.
func photonQuery(tags []string, name string, near [2]float64) url.Values {
	q := url.Values{
		"q":     {name},
		"lat":   {fmt.Sprintf("%f", near[1])},
		"lon":   {fmt.Sprintf("%f", near[0])},
		"bbox":  {fmt.Sprintf("%f,%f,%f,%f", near[0]-bboxDeg, near[1]-bboxDeg, near[0]+bboxDeg, near[1]+bboxDeg)},
		"limit": {fmt.Sprint(maxStations * 2)},
		"lang":  {"en"},
	}
	for _, t := range tags {
		q.Add("osm_tag", t)
	}
	return q
}

// askPhoton runs one Photon search and reads its answer, logging how long it
// took.
func (c *Client) askPhoton(ctx context.Context, q url.Values) (photonAnswer, error) {
	ctx, cancel := context.WithTimeout(ctx, photonTimeout)
	defer cancel()
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, photonURL()+"?"+q.Encode(), nil)
	if err != nil {
		return photonAnswer{}, err
	}
	req.Header.Set("User-Agent", "servenupphotos-pipeline")
	var answer photonAnswer
	err = c.readPhoton(req, &answer)
	slog.Info("photon search", "q", q.Get("q"), "took", time.Since(start).Round(time.Millisecond), "found", len(answer.Features), "err", err)
	return answer, err
}

// readPhoton sends req and decodes its answer into answer.
func (c *Client) readPhoton(req *http.Request, answer *photonAnswer) error {
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close() //nolint:errcheck // read-only body
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("it answered %s", res.Status)
	}
	return json.NewDecoder(res.Body).Decode(answer)
}

// photonStations are answer's features as stations, in Photon's order, each
// name once and at most maxStations.
func photonStations(answer photonAnswer, near [2]float64) []Station {
	out := []Station{}
	seen := map[string]bool{}
	for _, f := range answer.Features {
		name, at := f.Properties.Name, f.Geometry.Coordinates
		if name == "" || seen[name] || len(out) == maxStations {
			continue
		}
		seen[name] = true
		out = append(out, Station{Name: name, Latitude: at[1], Longitude: at[0], Km: kmBetween(near, at)})
	}
	return out
}
