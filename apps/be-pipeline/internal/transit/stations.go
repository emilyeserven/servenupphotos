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

// stationTags are, for each mode, the Overpass tag filters for what its
// stations are mapped as, one statement each, so a search finds only that
// kind: a ferry search no train stations, and a train search no subway ones. Each starts with a plain key, so
// the server can use its tag index instead of scanning every element nearby.
var stationTags = map[string][]string{
	"train":  {`[railway~"^(station|halt)$"][station!~"^(subway|light_rail|monorail)$"]`, `[public_transport=station][train=yes]`},
	"subway": {`[railway=station][station~"^(subway|light_rail|monorail)$"]`, `[public_transport=station][subway=yes]`},
	"bus":    {`[highway=bus_stop]`, `[amenity=bus_station]`, `[public_transport=station][bus=yes]`},
	"ferry":  {`[amenity=ferry_terminal]`, `[public_transport~"^(station|stop_position)$"][ferry=yes]`},
}

// nameKeys are the tags a station's name can be in, in any language, such as
// "name", "name:en", "name:ja-Latn" or "official_name".
const nameKeys = `^((official|alt|short|old)_)?name(:[A-Za-z_-]+)?$`

// stationsLimit is how many stations the server sends at most, before they're
// ranked by how many of the words typed they match.
const stationsLimit = 200

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
// [longitude, latitude], whose name in any language has the longest word of
// name, the ones with the most of name's words first, then the nearest, each
// name once. So "Shimonoseki Kokusai Terminal" finds 下関港国際ターミナル by its
// English or romaji name even when neither is spelled quite that way.
func (c *Client) Stations(ctx context.Context, mode, name string, near [2]float64) ([]Station, error) {
	tags, ok := stationTags[mode]
	if !ok {
		return nil, ErrNoKind
	}
	words := strings.Fields(strings.ToLower(name))
	if len(words) == 0 {
		return nil, ErrNoName
	}
	elements, err := c.query(ctx, stationsQuery(tags, longest(words), near))
	if err != nil {
		return nil, err
	}
	return bestStations(elements, words, near), nil
}

// longest is the longest of words, the one fewest names have.
func longest(words []string) string {
	return slices.MaxFunc(words, func(a, b string) int { return cmp.Compare(len([]rune(a)), len([]rune(b))) })
}

// stationsQuery is the Overpass QL for stations tagged as any of tags within
// stationsNearM of near whose name, in any language, contains word.
func stationsQuery(tags []string, word string, near [2]float64) string {
	around := fmt.Sprintf("(around:%d,%f,%f)", stationsNearM, near[1], near[0])
	var union strings.Builder
	for _, t := range tags {
		union.WriteString("nwr" + t + around + ";")
	}
	pattern := strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(regexp.QuoteMeta(word))
	return fmt.Sprintf(serverTimeout+`(%s)->.s;nwr.s[~"%s"~"%s",i];out tags center %d;`,
		union.String(), nameKeys, pattern, stationsLimit)
}

// ranked is a station with how many of the words typed its names have.
type ranked struct {
	Station
	hits int
}

// bestStations are elements as stations, those whose names have the most of
// words first and then the nearest, keeping the first of each name and at most
// maxStations.
func bestStations(elements []element, words []string, near [2]float64) []Station {
	found := []ranked{}
	for _, e := range elements {
		if s, ok := stationOf(e, near); ok {
			found = append(found, ranked{s, wordHits(e.Tags, words)})
		}
	}
	slices.SortStableFunc(found, func(a, b ranked) int { return cmp.Or(cmp.Compare(b.hits, a.hits), cmp.Compare(a.Km, b.Km)) })
	out := []Station{}
	seen := map[string]bool{}
	for _, r := range found {
		if !seen[r.Name] && len(out) < maxStations {
			out = append(out, r.Station)
		}
		seen[r.Name] = true
	}
	return out
}

// nameKeyPattern matches the tags nameKeys names.
var nameKeyPattern = regexp.MustCompile(nameKeys)

// wordHits is how many of words, each lower case, are in any of tags' names.
func wordHits(tags map[string]string, words []string) int {
	var names strings.Builder
	for k, v := range tags {
		if nameKeyPattern.MatchString(k) {
			names.WriteString(strings.ToLower(v) + "\n")
		}
	}
	all := names.String()
	hits := 0
	for _, w := range words {
		if strings.Contains(all, w) {
			hits++
		}
	}
	return hits
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
