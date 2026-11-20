package transit

import (
	"cmp"
	"regexp"
	"strings"

	"github.com/paulmach/osm"
)

// A rail line on OpenStreetMap is a route relation
// (https://wiki.openstreetmap.org/wiki/Relation:route) of the track it runs
// along, often one for each direction or branch, such as the Red Line's to
// Ashmont and to Braintree, gathered under one route master
// (https://wiki.openstreetmap.org/wiki/Relation:route_master) naming the
// line. The track's own names are often something else, such as "Track 3" or
// the name of the railroad it was built as, so the rail map names each way by
// the lines whose routes run along it.

// osmRailRouteKinds are the route values read as rail lines, as the rail map
// keeps their railways (see osmRailways).
var osmRailRouteKinds = map[string]bool{"train": true, "subway": true, "light_rail": true, "monorail": true}

// trackNumber matches a way's name that only numbers the track, such as
// "Track 3" or "2", which names no line.
var trackNumber = regexp.MustCompile(`(?i)^(track\s*)?\d+[a-z]?$`)

// osmRouteLine is the line a route relation is part of: its name, English
// name, color and operator.
type osmRouteLine struct {
	name, nameEn, colour, operator string
}

// osmRailRoutes gathers an extract's rail route relations and route masters,
// and then which lines run along each way.
type osmRailRoutes struct {
	// lines are each route's own line, from its tags.
	lines map[osm.RelationID]osmRouteLine
	// ways are the ways each route runs along.
	ways map[osm.RelationID][]osm.WayID
	// masters are the line of the route master each route is in.
	masters map[osm.RelationID]osmRouteLine
	// wayLines are the lines whose routes run along each way, each once,
	// filled in by resolve.
	wayLines map[osm.WayID][]osmRouteLine
}

// newOSMRailRoutes is an empty gathering.
func newOSMRailRoutes() osmRailRoutes {
	return osmRailRoutes{
		lines: map[osm.RelationID]osmRouteLine{}, ways: map[osm.RelationID][]osm.WayID{},
		masters: map[osm.RelationID]osmRouteLine{}, wayLines: map[osm.WayID][]osmRouteLine{},
	}
}

// add keeps rel when it's a rail route, or the route master of rail routes.
func (g osmRailRoutes) add(rel *osm.Relation) {
	switch rel.Tags.Find("type") {
	case "route":
		if !osmRailRouteKinds[rel.Tags.Find("route")] {
			return
		}
		g.lines[rel.ID] = routeLineOf(rel.Tags)
		for _, m := range rel.Members {
			if m.Type == osm.TypeWay && !isPlatform(m.Role) {
				g.ways[rel.ID] = append(g.ways[rel.ID], osm.WayID(m.Ref))
			}
		}
	case "route_master":
		if !osmRailRouteKinds[rel.Tags.Find("route_master")] {
			return
		}
		line := routeLineOf(rel.Tags)
		for _, m := range rel.Members {
			if m.Type == osm.TypeRelation {
				g.masters[osm.RelationID(m.Ref)] = line
			}
		}
	}
}

// resolve fills in the lines whose routes run along each way: a route's
// master's line, in the route's own color when the master has none, or else
// the route's own.
func (g osmRailRoutes) resolve() {
	for id, ways := range g.ways {
		line := g.lines[id]
		if master, ok := g.masters[id]; ok && master.name != "" {
			master.colour = cmp.Or(master.colour, line.colour)
			master.operator = cmp.Or(master.operator, line.operator)
			line = master
		}
		if line.name == "" {
			continue
		}
		for _, w := range ways {
			if !containsLine(g.wayLines[w], line.name) {
				g.wayLines[w] = append(g.wayLines[w], line)
			}
		}
	}
}

// containsLine reports whether lines has one named name.
func containsLine(lines []osmRouteLine, name string) bool {
	for _, l := range lines {
		if l.name == name {
			return true
		}
	}
	return false
}

// routeLineOf is the line a route or route master's tags name: its name less
// any direction, such as "Red Line" from "Red Line: Alewife => Ashmont", or
// else its ref.
func routeLineOf(tags osm.Tags) osmRouteLine {
	return osmRouteLine{
		name:     cmp.Or(lineName(tags.Find("name")), tags.Find("ref")),
		nameEn:   lineName(tags.Find("name:en")),
		colour:   tags.Find("colour"),
		operator: cmp.Or(tags.Find("operator:en"), tags.Find("operator")),
	}
}

// lineName is a route's name less the direction or stops after a colon or
// in brackets, such as "1호선" from "1호선 (소요산 → 인천)".
func lineName(name string) string {
	for _, sep := range []string{": ", " ("} {
		if before, _, ok := strings.Cut(name, sep); ok && strings.TrimSpace(before) != "" {
			name = before
		}
	}
	return strings.TrimSpace(name)
}
