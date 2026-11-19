package transit

import (
	"cmp"
	"context"
	"encoding/json"
	"io"
	"maps"
	"runtime"
	"slices"
	"strconv"

	"github.com/paulmach/osm"
	"github.com/paulmach/osm/osmpbf"
)

// An OpenStreetMap extract is read twice: first its railway ways, keeping the
// nodes they run through, and then those nodes' spots and the stations. What
// it keeps is written as the same two GeoJSON files as Japan's rail map, so
// both are read into a network the same way.

// osmRailways are the railway values kept, with the kind code each is kept as
// (see railKinds): 11 for railways, 16 light rail, 23 monorails and 31
// subways. Trams, funiculars, and disused or planned track are left out.
var osmRailways = map[string]int{"rail": 11, "narrow_gauge": 11, "light_rail": 16, "monorail": 23, "subway": 31}

// osmSkippedService are the railway service values left out: track in a yard
// or a siding, which no ride follows.
var osmSkippedService = map[string]bool{"yard": true, "siding": true, "spur": true}

// stationNearLineM is how near a line's track a station has to be, in meters,
// to be one of its stations.
const stationNearLineM = 300

// osmRailWay is one railway way kept: its line's name and the nodes it runs
// through.
type osmRailWay struct {
	name, nameEn, operator string
	kind                   int
	nodes                  []osm.NodeID
}

// osmStation is a station node: its name and spot.
type osmStation struct {
	name string
	at   [2]float64
}

// osmRailReader gathers the railways and stations of an extract, one element
// at a time.
type osmRailReader struct {
	ways     []osmRailWay
	needed   map[osm.NodeID][2]float64
	stations []osmStation
}

// newOSMRailReader is an empty reader.
func newOSMRailReader() *osmRailReader {
	return &osmRailReader{needed: map[osm.NodeID][2]float64{}}
}

// addWay keeps w when it's a railway a ride can follow.
func (r *osmRailReader) addWay(w *osm.Way) {
	kind, ok := osmRailways[w.Tags.Find("railway")]
	if !ok || osmSkippedService[w.Tags.Find("service")] || len(w.Nodes) < 2 {
		return
	}
	way := osmRailWay{
		name: w.Tags.Find("name"), nameEn: w.Tags.Find("name:en"),
		operator: cmp.Or(w.Tags.Find("operator:en"), w.Tags.Find("operator")), kind: kind,
	}
	for _, n := range w.Nodes {
		way.nodes = append(way.nodes, n.ID)
		r.needed[n.ID] = [2]float64{}
	}
	r.ways = append(r.ways, way)
}

// addNode keeps n's spot when a railway kept runs through it, and n when it's
// a named station.
func (r *osmRailReader) addNode(n *osm.Node) {
	at := [2]float64{n.Lon, n.Lat}
	if _, ok := r.needed[n.ID]; ok {
		r.needed[n.ID] = at
	}
	switch n.Tags.Find("railway") {
	case "station", "halt":
		if name := cmp.Or(n.Tags.Find("name:en"), n.Tags.Find("name")); name != "" {
			r.stations = append(r.stations, osmStation{name, at})
		}
	}
}

// osmLine is a line gathered from its ways: their name, the English one most
// of them have, and their operator.
type osmLine struct {
	name, operator string
	kind           int
}

// features are the railways and stations gathered, as the sections and
// stations of a rail map: each way a section of its line, named by its name
// (in English where most of the line's ways have one), and each station once
// for each line within stationNearLineM of it.
func (r *osmRailReader) features() (sections, stations []mlitFeature) {
	lines := r.lines()
	cells := map[[2]int32][]linePoint{}
	for _, w := range r.ways {
		line := lines[w.name]
		coords := make([][2]float64, 0, len(w.nodes))
		for _, id := range w.nodes {
			coords = append(coords, r.needed[id])
			if line.name != "" {
				addToCell(cells, r.needed[id], line.name)
			}
		}
		sections = append(sections, railFeatureOf(line, "", coords))
	}
	byName := map[string]osmLine{}
	for _, l := range lines {
		byName[l.name] = l
	}
	for _, s := range r.stations {
		for _, name := range slices.Sorted(maps.Keys(linesNearSpot(cells, s.at))) {
			stations = append(stations, railFeatureOf(byName[name], s.name, [][2]float64{s.at, s.at}))
		}
	}
	return sections, stations
}

// lines are the lines of the ways kept, by their ways' name: each named in
// English when most of its ways have an English name, run by its ways' most
// common operator.
func (r *osmRailReader) lines() map[string]osmLine {
	en := map[string]map[string]int{}
	ops := map[string]map[string]int{}
	total := map[string]int{}
	kinds := map[string]int{}
	for _, w := range r.ways {
		count(en, w.name, w.nameEn)
		count(ops, w.name, w.operator)
		total[w.name]++
		kinds[w.name] = w.kind
	}
	out := map[string]osmLine{}
	for name, n := range total {
		display := name
		if english, times := mostCommon(en[name]); english != "" && times*2 > n {
			display = english
		}
		operator, _ := mostCommon(ops[name])
		out[name] = osmLine{name: display, operator: operator, kind: kinds[name]}
	}
	if _, ok := out[""]; ok {
		out[""] = osmLine{kind: kinds[""]}
	}
	return out
}

// count adds one to counts[key][value], leaving out an empty value.
func count(counts map[string]map[string]int, key, value string) {
	if value == "" {
		return
	}
	if counts[key] == nil {
		counts[key] = map[string]int{}
	}
	counts[key][value]++
}

// mostCommon is the value counted most, the first by name on a tie, and how
// many times; "" with none.
func mostCommon(counts map[string]int) (string, int) {
	best, times := "", 0
	for _, v := range slices.Sorted(maps.Keys(counts)) {
		if counts[v] > times {
			best, times = v, counts[v]
		}
	}
	return best, times
}

// linePoint is a point of a named line's track.
type linePoint struct {
	at   [2]float64
	line string
}

// addToCell keeps p, a point of line's track, in its grid cell.
func addToCell(cells map[[2]int32][]linePoint, p [2]float64, line string) {
	c := cellOf(p)
	cells[c] = append(cells[c], linePoint{p, line})
}

// linesNearSpot are the lines with a point of track within stationNearLineM
// of p, looking in p's grid cell and those next to it.
func linesNearSpot(cells map[[2]int32][]linePoint, p [2]float64) map[string]bool {
	c := cellOf(p)
	out := map[string]bool{}
	for dx := int32(-1); dx <= 1; dx++ {
		for dy := int32(-1); dy <= 1; dy++ {
			for _, lp := range cells[[2]int32{c[0] + dx, c[1] + dy}] {
				if meters(lp.at, p) <= stationNearLineM {
					out[lp.line] = true
				}
			}
		}
	}
	return out
}

// railFeatureOf is a section of line through coords, or its station named
// station.
func railFeatureOf(line osmLine, station string, coords [][2]float64) mlitFeature {
	var f mlitFeature
	f.Properties.Type = json.Number(strconv.Itoa(line.kind))
	f.Properties.Line, f.Properties.Operator, f.Properties.Station = line.name, line.operator, station
	raw, _ := json.Marshal(coords) //nolint:errchkjson // plain numbers always marshal
	f.Geometry = tlGeometry{Type: "LineString", Coordinates: raw}
	return f
}

// readOSMRail reads an extract's railways and stations from open, which opens
// the .osm.pbf file afresh for each of its two passes.
func readOSMRail(ctx context.Context, open func() (io.ReadCloser, error)) (sections, stations []mlitFeature, err error) {
	r := newOSMRailReader()
	if err := scanPBF(ctx, open, false, func(o osm.Object) {
		if w, ok := o.(*osm.Way); ok {
			r.addWay(w)
		}
	}); err != nil {
		return nil, nil, err
	}
	if err := scanPBF(ctx, open, true, func(o osm.Object) {
		if n, ok := o.(*osm.Node); ok {
			r.addNode(n)
		}
	}); err != nil {
		return nil, nil, err
	}
	sections, stations = r.features()
	return sections, stations, nil
}

// scanPBF passes each way of the file open opens to each, or each node when
// nodes is set.
func scanPBF(ctx context.Context, open func() (io.ReadCloser, error), nodes bool, each func(osm.Object)) error {
	f, err := open()
	if err != nil {
		return err
	}
	defer f.Close() //nolint:errcheck // read-only
	s := osmpbf.New(ctx, f, runtime.GOMAXPROCS(0))
	defer s.Close() //nolint:errcheck // read-only
	s.SkipRelations = true
	s.SkipNodes, s.SkipWays = !nodes, nodes
	for s.Scan() {
		each(s.Object())
	}
	return s.Err()
}
