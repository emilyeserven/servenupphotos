// Package areas looks up the outline of an area, such as a park, a
// neighbourhood or a city, so photos without an exact spot can be shown in
// the area they were taken in rather than at a made-up point.
//
// It asks OpenStreetMap's Nominatim search server
// (https://nominatim.org/release-docs/latest/api/Search/), whose usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) allows at most
// one request a second from an application that names itself. A Wikidata item
// ID, such as Q1490, is looked up through its OpenStreetMap relation ID
// (https://www.wikidata.org/wiki/Property:P402). NOMINATIM_URL and
// WIKIDATA_URL point it at other servers with the same paths.
package areas

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/throttle"
)

// Default servers: OpenStreetMap's Nominatim and Wikidata.
const (
	DefaultNominatimURL = "https://nominatim.openstreetmap.org"
	DefaultWikidataURL  = "https://www.wikidata.org"
)

// userAgent names the pipeline to the servers, as their policies ask.
const userAgent = "servenupphotos-pipeline (https://github.com/emilyeserven/servenupphotos)"

// Limits on an answer: how many areas, and how many points an outline keeps.
const (
	maxAreas  = 8
	MaxPoints = 5000
	// simplify is how far, in degrees (about 50 m), Nominatim may move an
	// outline's points to keep it small.
	simplify = "0.0005"
)

// ErrNoRelation is returned for a Wikidata item with no OpenStreetMap
// relation ID, so no outline to look up.
var ErrNoRelation = errors.New("the Wikidata item has no OpenStreetMap relation (P402)")

// qid matches a Wikidata item ID, such as Q1490.
var qid = regexp.MustCompile(`^Q[1-9][0-9]*$`)

// Shape is a GeoJSON MultiPolygon's coordinates: polygons, each an outer ring
// then any holes, each ring [longitude, latitude] points ending where it
// starts.
type Shape [][][][2]float64

// Area is one area found, with its outline.
type Area struct {
	// Name is what it's called, such as "Osaka Castle Park".
	Name string `json:"name"`
	// Place is where it is, as Nominatim writes it in full.
	Place string `json:"place"`
	// Kind is what sort of area it is, such as "park" or "city".
	Kind string `json:"kind"`
	// OSM is its OpenStreetMap ID, such as "R358674" for a relation.
	OSM string `json:"osm"`
	// Shape is its outline.
	Shape Shape `json:"shape"`
}

// Client looks up areas, at most one request per Gate's gap across both
// servers.
type Client struct {
	NominatimURL string
	WikidataURL  string
	HTTP         *http.Client
	// Gate spaces requests out, as the servers ask.
	Gate throttle.Gate
}

// New is a client for NOMINATIM_URL and WIKIDATA_URL, or else the defaults.
func New() *Client {
	return &Client{
		NominatimURL: envURL("NOMINATIM_URL", DefaultNominatimURL),
		WikidataURL:  envURL("WIKIDATA_URL", DefaultWikidataURL),
		HTTP:         &http.Client{Timeout: 15 * time.Second},
		Gate:         throttle.Gate{Gap: time.Second},
	}
}

// envURL is the address in the environment variable name, or else def.
func envURL(name, def string) string {
	if v := strings.TrimSuffix(os.Getenv(name), "/"); v != "" {
		return v
	}
	return def
}

// Find is the areas with an outline that match query: a name, such as "Osaka
// Castle Park", or a Wikidata item ID, such as Q1490.
func (c *Client) Find(ctx context.Context, query string) ([]Area, error) {
	query = strings.TrimSpace(query)
	if qid.MatchString(query) {
		return c.wikidata(ctx, query)
	}
	q := url.Values{"q": {query}, "limit": {fmt.Sprint(maxAreas)}}
	return c.nominatim(ctx, "/search", q)
}

// wikidata is the area of Wikidata item id, through its OpenStreetMap
// relation.
func (c *Client) wikidata(ctx context.Context, id string) ([]Area, error) {
	var item entityData
	if err := c.get(ctx, c.WikidataURL+"/wiki/Special:EntityData/"+id+".json", &item); err != nil {
		return nil, err
	}
	relation := item.relation(id)
	if relation == "" {
		return nil, ErrNoRelation
	}
	return c.nominatim(ctx, "/lookup", url.Values{"osm_ids": {"R" + relation}})
}

// nominatim asks Nominatim's path with q and its outlines, keeping the
// answers that are areas.
func (c *Client) nominatim(ctx context.Context, path string, q url.Values) ([]Area, error) {
	q.Set("format", "jsonv2")
	q.Set("polygon_geojson", "1")
	q.Set("polygon_threshold", simplify)
	var places []place
	if err := c.get(ctx, c.NominatimURL+path+"?"+q.Encode(), &places); err != nil {
		return nil, err
	}
	return areasOf(places), nil
}

// get waits its turn, asks for address and reads the JSON answer into out.
func (c *Client) get(ctx context.Context, address string, out any) error {
	if err := c.Gate.Wait(ctx); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close() //nolint:errcheck // read-only body
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("the server answered %s", res.Status)
	}
	return json.NewDecoder(res.Body).Decode(out)
}
