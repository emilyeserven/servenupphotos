package transit

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Geofabrik (https://download.geofabrik.de) publishes OpenStreetMap's data cut
// into countries and smaller regions, each a .osm.pbf file, and an index of
// them with each one's outline (https://download.geofabrik.de/technical.html).
// The OpenStreetMap rail map downloads the index once, picks the smallest
// region holding both ends of a look-up, such as South Korea, and downloads
// that region once.

// DefaultGeofabrikIndexURL is Geofabrik's index of its regions with their
// outlines.
const DefaultGeofabrikIndexURL = "https://download.geofabrik.de/index-v1.json"

// geofabrikIndexFile is the index's file in the rail map's folder.
const geofabrikIndexFile = "index-v1.json"

// errNoRegion is a look-up whose ends aren't both in one country's extract.
var errNoRegion = errors.New("no OpenStreetMap extract holds both ends; Geofabrik cuts its extracts by country, so a leg crossing a border isn't covered")

// osmRegion is one of Geofabrik's regions, such as South Korea.
type osmRegion struct {
	// id is Geofabrik's ID for it, such as "south-korea".
	id string
	// name is its name, such as "South Korea".
	name string
	// pbf is the address of its .osm.pbf file.
	pbf string
	// polygons are its outline, each polygon's rings each [longitude, latitude].
	polygons [][][][2]float64
	// box is its outline's bounding box: west, south, east, north.
	box [4]float64
}

// geofabrikIndex reads Geofabrik's index of regions, keeping only those within
// a larger one: a continent alone would be gigabytes.
func geofabrikIndex(body []byte) ([]osmRegion, error) {
	var fc struct {
		Features []struct {
			Properties struct {
				ID     string `json:"id"`
				Parent string `json:"parent"`
				Name   string `json:"name"`
				URLs   struct {
					PBF string `json:"pbf"`
				} `json:"urls"`
			} `json:"properties"`
			Geometry tlGeometry `json:"geometry"`
		} `json:"features"`
	}
	if err := json.Unmarshal(body, &fc); err != nil {
		return nil, fmt.Errorf("the index of extracts couldn't be read: %w", err)
	}
	var out []osmRegion
	for _, f := range fc.Features {
		p := f.Properties
		polygons := f.Geometry.polygons()
		if p.Parent == "" || p.URLs.PBF == "" || len(polygons) == 0 {
			continue
		}
		out = append(out, osmRegion{id: p.ID, name: cmp.Or(p.Name, p.ID), pbf: p.URLs.PBF, polygons: polygons, box: boxOf(polygons)})
	}
	return out, nil
}

// polygons are g's polygons when it's a Polygon or MultiPolygon; none
// otherwise.
func (g *tlGeometry) polygons() [][][][2]float64 {
	var out [][][][2]float64
	switch g.Type {
	case "MultiPolygon":
		_ = json.Unmarshal(g.Coordinates, &out)
	case "Polygon":
		var p [][][2]float64
		if json.Unmarshal(g.Coordinates, &p) == nil {
			out = [][][][2]float64{p}
		}
	}
	return out
}

// boxOf is the bounding box of polygons: west, south, east, north.
func boxOf(polygons [][][][2]float64) [4]float64 {
	box := [4]float64{180, 90, -180, -90}
	for _, poly := range polygons {
		for _, ring := range poly {
			for _, p := range ring {
				box = [4]float64{min(box[0], p[0]), min(box[1], p[1]), max(box[2], p[0]), max(box[3], p[1])}
			}
		}
	}
	return box
}

// holds reports whether r's outline holds p.
func (r osmRegion) holds(p [2]float64) bool {
	if p[0] < r.box[0] || p[0] > r.box[2] || p[1] < r.box[1] || p[1] > r.box[3] {
		return false
	}
	for _, poly := range r.polygons {
		inside := false
		for _, ring := range poly {
			if ringHolds(ring, p) {
				inside = !inside
			}
		}
		if inside {
			return true
		}
	}
	return false
}

// ringHolds reports whether the ring holds p, by counting the ring's edges a
// line east from p crosses.
func ringHolds(ring [][2]float64, p [2]float64) bool {
	inside := false
	for i, j := 0, len(ring)-1; i < len(ring); j, i = i, i+1 {
		a, b := ring[i], ring[j]
		if (a[1] > p[1]) != (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0] {
			inside = !inside
		}
	}
	return inside
}

// area is r's bounding box's area, in square degrees: enough to tell a
// country from the larger region it's in.
func (r osmRegion) area() float64 {
	return (r.box[2] - r.box[0]) * (r.box[3] - r.box[1])
}

// regionFor is the index of the smallest region of regions holding both a and
// b, such as South Korea for Seoul and Busan.
func regionFor(regions []osmRegion, a, b [2]float64) (int, error) {
	best := -1
	for i, r := range regions {
		if r.holds(a) && r.holds(b) && (best < 0 || r.area() < regions[best].area()) {
			best = i
		}
	}
	if best < 0 {
		return 0, errNoRegion
	}
	return best, nil
}

// osmRegions is Geofabrik's index, from the rail map's folder, downloaded there
// first when it isn't there yet.
func (c *Client) osmRegions(ctx context.Context) ([]osmRegion, error) {
	c.osmIndexMu.Lock()
	defer c.osmIndexMu.Unlock()
	if c.osmIndex != nil {
		return c.osmIndex, nil
	}
	path := filepath.Join(osmRailDir(), geofabrikIndexFile)
	body, err := os.ReadFile(path) //nolint:gosec // the rail map's own folder
	if err != nil {
		if body, err = c.downloadIndex(ctx, path); err != nil {
			return nil, &RailMapError{Map: "OpenStreetMap's list of extracts", Err: err}
		}
	}
	regions, err := geofabrikIndex(body)
	if err != nil {
		return nil, err
	}
	c.osmIndex = regions
	return regions, nil
}

// downloadIndex downloads Geofabrik's index and keeps it at path.
func (c *Client) downloadIndex(ctx context.Context, path string) ([]byte, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	url := cmp.Or(strings.TrimSpace(os.Getenv("GEOFABRIK_INDEX_URL")), DefaultGeofabrikIndexURL)
	if _, err := fetchTo(ctx, c.HTTP, url, &buf); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, buf.Bytes(), 0o600); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
