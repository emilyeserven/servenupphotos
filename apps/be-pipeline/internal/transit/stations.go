package transit

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"
)

// stationsNearM is how far from the spot given, in meters, Stations looks:
// far enough for a city's stations, near enough to keep the query light.
const stationsNearM = 30000

// maxStations is the most stations Stations answers.
const maxStations = 15

// ErrNoName is returned when a station search has no name to look for.
var ErrNoName = errors.New("no station name to look for")

// stationTags are, for each mode, the Overpass filter for what its stations
// are mapped as: a key and a value, each a regex.
var stationTags = map[string]string{
	"train":  `[~"^(railway|public_transport)$"~"^(station|halt)$"]`,
	"subway": `[~"^(railway|public_transport)$"~"^(station|halt)$"]`,
	"bus":    `[~"^(highway|amenity|public_transport)$"~"^(bus_stop|bus_station|station)$"]`,
	"ferry":  `[~"^(amenity|public_transport)$"~"^(ferry_terminal|station)$"]`,
}

// Station is a station or stop found by name, such as "Hakata".
type Station struct {
	// Name is its name, such as "博多"; NameEn its English name, "" when none.
	Name      string  `json:"name"`
	NameEn    string  `json:"nameEn,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	// Km is how far it is from the spot it was looked for near.
	Km float64 `json:"km"`
}

// Stations are mode's stations or stops within stationsNearM of near, each
// [longitude, latitude], whose name in any language contains name, nearest
// first, each name once.
func (c *Client) Stations(ctx context.Context, mode, name string, near [2]float64) ([]Station, error) {
	tags, ok := stationTags[mode]
	if !ok {
		return nil, ErrNoKind
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNoName
	}
	elements, err := c.query(ctx, stationsQuery(tags, name, near))
	if err != nil {
		return nil, err
	}
	return nearestStations(elements, near), nil
}

// stationsQuery is the Overpass QL for stations tagged tags within
// stationsNearM of near whose name, in any language, contains name.
func stationsQuery(tags, name string, near [2]float64) string {
	pattern := strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(regexp.QuoteMeta(name))
	return fmt.Sprintf(serverTimeout+`nwr%s[~"^name(:[a-z]+)?$"~"%s",i](around:%d,%f,%f);out tags center 60;`,
		tags, pattern, stationsNearM, near[1], near[0])
}

// nearestStations are elements as stations, nearest near first, keeping
// the nearest of each name and at most maxStations.
func nearestStations(elements []element, near [2]float64) []Station {
	out := []Station{}
	for _, e := range elements {
		if s, ok := stationOf(e, near); ok {
			out = append(out, s)
		}
	}
	slices.SortFunc(out, func(a, b Station) int { return cmp.Compare(a.Km, b.Km) })
	seen := map[string]bool{}
	out = slices.DeleteFunc(out, func(s Station) bool {
		dup := seen[s.Name]
		seen[s.Name] = true
		return dup
	})
	return out[:min(len(out), maxStations)]
}

// stationOf is e as a station, and false when it has no name or no spot.
func stationOf(e element, near [2]float64) (Station, bool) {
	lat, lon := e.Lat, e.Lon
	if e.Center != nil {
		lat, lon = e.Center.Lat, e.Center.Lon
	}
	name := cmp.Or(e.Tags["name"], e.Tags["name:en"])
	if name == "" || (lat == 0 && lon == 0) {
		return Station{}, false
	}
	en := e.Tags["name:en"]
	if en == name {
		en = ""
	}
	return Station{Name: name, NameEn: en, Latitude: lat, Longitude: lon, Km: kmBetween(near, [2]float64{lon, lat})}, true
}

// kmBetween is how far apart two [longitude, latitude] spots are along the
// Earth's surface, in km, to one decimal place.
func kmBetween(a, b [2]float64) float64 {
	rad := math.Pi / 180
	dLat, dLng := (b[1]-a[1])*rad, (b[0]-a[0])*rad
	h := math.Pow(math.Sin(dLat/2), 2) + math.Cos(a[1]*rad)*math.Cos(b[1]*rad)*math.Pow(math.Sin(dLng/2), 2)
	return math.Round(2*6371*math.Asin(math.Sqrt(h))*10) / 10
}
