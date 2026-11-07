package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/areas"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// placeAreaExt ends a place's area file, <folder>/places/<id>.geo.json. Like
// TRIPLINES.geo.json, it's left out of the combined lists (see isDataFile),
// so PLACES.json stays small and the portfolio loads an outline only when it
// shows it.
const placeAreaExt = ".geo.json"

// PlaceArea is the outline of the area a place covers, such as a park, which
// the portfolio's map shades.
type PlaceArea struct {
	// OSM is the area's OpenStreetMap ID, such as "R358674", when it was
	// looked up there; "" for none.
	OSM string `json:"osm,omitempty"`
	// Shape is the outline, as a GeoJSON MultiPolygon's coordinates.
	Shape areas.Shape `json:"shape"`
}

// placeAreaFeature is a place's area file: a GeoJSON Feature, so map tools
// can open it as it is.
type placeAreaFeature struct {
	Type       string            `json:"type"`
	Properties placeAreaProps    `json:"properties"`
	Geometry   placeAreaGeometry `json:"geometry"`
}

// placeAreaProps say whose area it is.
type placeAreaProps struct {
	// Place is the place's ID.
	Place string `json:"place"`
	OSM   string `json:"osm,omitempty"`
}

// placeAreaGeometry is a GeoJSON MultiPolygon.
type placeAreaGeometry struct {
	Type        string      `json:"type"`
	Coordinates areas.Shape `json:"coordinates"`
}

// isPlaceArea reports whether p is a place's area file in the data folder at
// root.
func isPlaceArea(root, p string) bool {
	return inFolder(root+"/"+Places.Folder, p) && strings.HasSuffix(strings.ToLower(p), placeAreaExt)
}

// placeAreaPath is the area file of place id.
func placeAreaPath(root, id string) string {
	return root + "/" + Places.Folder + "/" + id + placeAreaExt
}

// PlaceAreaOf is place id's area, as its file has it, or nil when it has
// none.
func (c *Client) PlaceAreaOf(ctx context.Context, gh settings.GitHub, id string) (*PlaceArea, error) {
	if perr := validEntryID(Places.Name, id); perr != nil {
		return nil, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return nil, perr
	}
	data, ok := w.file(placeAreaPath(w.root, id))
	if !ok {
		return nil, nil //nolint:nilnil // no area is not an error
	}
	var f placeAreaFeature
	if json.Unmarshal(data, &f) != nil {
		return nil, publishErr(http.StatusUnprocessableEntity, "The area file of place %q isn't a GeoJSON Feature.", id)
	}
	return &PlaceArea{OSM: f.Properties.OSM, Shape: f.Geometry.Coordinates}, nil
}

// SavePlaceArea saves area as place id's area file, new or replacing the one
// there, in the pending changes. It fails when there's no such place or the
// outline isn't valid.
func (c *Client) SavePlaceArea(ctx context.Context, gh settings.GitHub, id string, area PlaceArea) (EntryResult, error) {
	if perr := validPlaceArea(id, area); perr != nil {
		return EntryResult{}, perr
	}
	w, perr := c.placeWorkspace(ctx, gh, id)
	if perr != nil {
		return EntryResult{}, perr
	}
	feature := placeAreaFeature{
		Type:       "Feature",
		Properties: placeAreaProps{Place: id, OSM: strings.TrimSpace(area.OSM)},
		Geometry:   placeAreaGeometry{Type: "MultiPolygon", Coordinates: area.Shape},
	}
	b, err := json.Marshal(feature)
	if err != nil {
		return EntryResult{}, publishErr(http.StatusInternalServerError, "Couldn't encode the area.")
	}
	return c.savePlaceAreaFile(w, placeAreaPath(w.root, id), formatJSONFile(b))
}

// DeletePlaceArea removes place id's area file in the pending changes.
func (c *Client) DeletePlaceArea(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	if perr := validEntryID(Places.Name, id); perr != nil {
		return EntryResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	file := placeAreaPath(w.root, id)
	if _, ok := w.file(file); !ok {
		return EntryResult{}, publishErr(http.StatusNotFound, "Place %q has no area.", id)
	}
	return c.savePlaceAreaFile(w, file, nil)
}

// validPlaceArea fails unless id is a place ID and area has a valid outline.
func validPlaceArea(id string, area PlaceArea) *PublishError {
	if perr := validEntryID(Places.Name, id); perr != nil {
		return perr
	}
	return validShape(area.Shape, "The area")
}

// placeWorkspace is the workspace, failing when it has no place id.
func (c *Client) placeWorkspace(ctx context.Context, gh settings.GitHub, id string) (*workspace, *PublishError) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return nil, perr
	}
	if _, ok := w.file(w.root + "/" + Places.Folder + "/" + id + ".json"); !ok {
		return nil, publishErr(http.StatusNotFound, "There's no place with the ID %q.", id)
	}
	return w, nil
}

// savePlaceAreaFile stages content (nil to remove it) as the area file at
// file, unless it's already that.
func (c *Client) savePlaceAreaFile(w *workspace, file string, content []byte) (EntryResult, error) {
	before, _ := w.file(file)
	data := json.RawMessage("null")
	if content != nil {
		data = content
	}
	result := EntryResult{Path: file, Data: data, Before: before, pendingSave: w.pendingSave(nil)}
	if content != nil && bytes.Equal(before, content) {
		return result, nil
	}
	var perr *PublishError
	if result.pendingSave, perr = c.saveFiles(w, []ScanChange{{Path: file, Before: before, After: content}}); perr != nil {
		return EntryResult{}, perr
	}
	result.Changed = true
	return result, nil
}
