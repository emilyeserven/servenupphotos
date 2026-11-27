// Package transit finds the train, subway and bus lines on the maps the
// pipeline downloads and reads itself: Japan's rail map from MLIT, and a
// country's OpenStreetMap rail and bus maps from Geofabrik's extracts. It
// answers the lines near two spots, one line's track between them and its
// stops, so a trip line's hop can follow the line actually ridden instead of
// going straight.
//
// The look-ups that only ask a public server (OpenStreetMap's Overpass
// servers, Transitland and Photon) are answered by the BFF instead
// (apps/bff-pipeline/src/routes/transit.ts, docs/bff-routes.md), which
// relays the requests for these maps here.
package transit

import (
	"errors"
	"net/http"
	"sync"
)

// ErrNoKind is returned for a way of travelling with no mapped lines, such as
// a walk, or for a mode the map doesn't have, such as a bus on a rail map.
var ErrNoKind = errors.New("no transit lines for this way of travelling")

// Line is one transit line OpenStreetMap maps: usually one direction of one
// route, such as the Midosuji Line toward Esaka.
type Line struct {
	// ID is the route relation's OpenStreetMap ID.
	ID int64 `json:"id"`
	// Name is the line's name, such as "Midosuji Line: Nakamozu → Esaka".
	Name string `json:"name"`
	// Ref is its short number or letter, such as "M"; "" when none.
	Ref string `json:"ref,omitempty"`
	// Colour is the line's color as a hex code, such as "#e5171f"; "" when none.
	Colour string `json:"colour,omitempty"`
	// Kind is OpenStreetMap's route value, such as "subway".
	Kind string `json:"kind"`
	// From and To are where the line starts and ends; "" when not mapped.
	From string `json:"from,omitempty"`
	To   string `json:"to,omitempty"`
	// Source is the map the line was found on, such as "mlit" or "osmbus"
	// (see Searched).
	Source string `json:"source,omitempty"`
}

// Client downloads and reads the rail and bus maps, each once.
type Client struct {
	// HTTP downloads the maps and Geofabrik's index of extracts.
	HTTP *http.Client
	// Rails are the rail maps, each loaded the first time it's asked.
	Rails mapLoads[*railNet]
	// Buses are OpenStreetMap's bus maps, each loaded the first time it's
	// asked.
	Buses mapLoads[*busNet]
	// progress lists the maps being downloaded or read (see Downloads).
	progress mapProgress
	// osmExtractMu lets one OpenStreetMap extract download at a time, so a
	// rail and a bus look-up in one country download it once.
	osmExtractMu sync.Mutex
	// osmIndex is Geofabrik's index of OpenStreetMap extracts, once read.
	osmIndex   []osmRegion
	osmIndexMu sync.Mutex
}

// New is a client for the rail and bus maps.
func New() *Client {
	return &Client{HTTP: &http.Client{}}
}

// element is one OpenStreetMap element in an Overpass answer.
type element struct {
	Type    string            `json:"type"`
	ID      int64             `json:"id"`
	Tags    map[string]string `json:"tags"`
	Members []member          `json:"members"`
	// Lat and Lon are a node's spot.
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
	// Center is a way's or relation's middle, when asked for with "out center".
	Center *struct {
		Lat float64 `json:"lat"`
		Lon float64 `json:"lon"`
	} `json:"center"`
}

// member is one member of a route relation, with its geometry.
type member struct {
	Type     string `json:"type"`
	Ref      int64  `json:"ref"`
	Role     string `json:"role"`
	Geometry []struct {
		Lat float64 `json:"lat"`
		Lon float64 `json:"lon"`
	} `json:"geometry"`
}
