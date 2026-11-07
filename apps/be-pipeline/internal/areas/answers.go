package areas

import (
	"encoding/json"
	"fmt"
	"strings"
)

// place is the part of a Nominatim answer read.
type place struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"display_name"`
	Type        string   `json:"type"`
	AddressType string   `json:"addresstype"`
	OSMType     string   `json:"osm_type"`
	OSMID       int64    `json:"osm_id"`
	GeoJSON     geometry `json:"geojson"`
}

// geometry is a GeoJSON geometry, its coordinates read once its type is
// known.
type geometry struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
}

// areasOf is the places that have an outline, as areas, up to maxAreas.
func areasOf(places []place) []Area {
	out := []Area{}
	for _, p := range places {
		shape, ok := shapeOf(p.GeoJSON)
		if !ok || len(out) == maxAreas {
			continue
		}
		out = append(out, Area{Name: nameOf(p), Place: p.DisplayName, Kind: kindOf(p), OSM: osmID(p), Shape: shape})
	}
	return out
}

// shapeOf is g as a MultiPolygon's coordinates, and false when it isn't a
// polygon or has more than MaxPoints points.
func shapeOf(g geometry) (Shape, bool) {
	var shape Shape
	switch g.Type {
	case "Polygon":
		var rings [][][2]float64
		if json.Unmarshal(g.Coordinates, &rings) != nil {
			return nil, false
		}
		shape = Shape{rings}
	case "MultiPolygon":
		if json.Unmarshal(g.Coordinates, &shape) != nil {
			return nil, false
		}
	default:
		return nil, false
	}
	n := Points(shape)
	return shape, n > 0 && n <= MaxPoints
}

// Points is how many points shape has.
func Points(shape Shape) int {
	n := 0
	for _, polygon := range shape {
		for _, ring := range polygon {
			n += len(ring)
		}
	}
	return n
}

// nameOf is the place's name, or else the first part of where it is.
func nameOf(p place) string {
	if p.Name != "" {
		return p.Name
	}
	first, _, _ := strings.Cut(p.DisplayName, ",")
	return strings.TrimSpace(first)
}

// kindOf is what sort of area the place is: its address type, such as
// "city", or else its type, such as "park".
func kindOf(p place) string {
	if p.AddressType != "" {
		return p.AddressType
	}
	return p.Type
}

// osmID is the place's OpenStreetMap ID with its type's letter, such as
// "R358674".
func osmID(p place) string {
	if p.OSMType == "" {
		return ""
	}
	return fmt.Sprintf("%s%d", strings.ToUpper(p.OSMType[:1]), p.OSMID)
}

// entityData is the part of Wikidata's Special:EntityData answer read: each
// item's OpenStreetMap relation ID claims.
type entityData struct {
	Entities map[string]struct {
		Claims map[string][]struct {
			Mainsnak struct {
				Datavalue struct {
					Value json.RawMessage `json:"value"`
				} `json:"datavalue"`
			} `json:"mainsnak"`
		} `json:"claims"`
	} `json:"entities"`
}

// relation is item id's first OpenStreetMap relation ID (P402), or "".
func (e entityData) relation(id string) string {
	for _, claim := range e.Entities[id].Claims["P402"] {
		var v string
		if json.Unmarshal(claim.Mainsnak.Datavalue.Value, &v) == nil && v != "" {
			return v
		}
	}
	return ""
}
