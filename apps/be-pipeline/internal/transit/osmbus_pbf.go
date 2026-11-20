package transit

import (
	"context"
	"io"

	"github.com/paulmach/osm"
)

// A bus map is read from an OpenStreetMap extract in three passes, since a
// bus route is a relation (https://wiki.openstreetmap.org/wiki/Relation:route)
// of the roads it runs on and its stops, and the file lists every node, then
// every way, then every relation: first the bus routes, keeping the ways and
// stops they name, then those ways, keeping the nodes they run through, and
// then those nodes' spots and the stops' names.

// osmBusRoutes are the route values read as bus routes, as an Overpass bus
// look-up finds them (see routeKinds).
var osmBusRoutes = map[string]bool{"bus": true, "trolleybus": true, "coach": true}

// osmBusTags are the route's tags kept, which name the line (see lineOf).
var osmBusTags = []string{"name", "name:en", "ref", "colour", "route", "from", "to"}

// osmBusRelation is one bus route kept: its tags, the ways it runs along in
// order, and its stop and platform nodes in order.
type osmBusRelation struct {
	id    int64
	tags  map[string]string
	ways  []osm.WayID
	nodes []member
}

// osmBusReader gathers the bus routes of an extract, one element at a time.
type osmBusReader struct {
	routes []osmBusRelation
	// wayNodes are the nodes each way a route runs along goes through,
	// filled in by the second pass.
	wayNodes map[osm.WayID][]osm.NodeID
	// spots are the spots of the nodes those ways go through, filled in by
	// the third pass.
	spots map[osm.NodeID][2]float64
	// stops are the routes' stop and platform nodes, with their names,
	// filled in by the third pass.
	stops map[int64]element
}

// newOSMBusReader is an empty reader.
func newOSMBusReader() *osmBusReader {
	return &osmBusReader{wayNodes: map[osm.WayID][]osm.NodeID{}, spots: map[osm.NodeID][2]float64{}, stops: map[int64]element{}}
}

// addRelation keeps r when it's a bus route, noting the ways and stops it
// names for the passes after.
func (r *osmBusReader) addRelation(rel *osm.Relation) {
	if rel.Tags.Find("type") != "route" || !osmBusRoutes[rel.Tags.Find("route")] {
		return
	}
	route := osmBusRelation{id: int64(rel.ID), tags: map[string]string{}}
	for _, key := range osmBusTags {
		if v := rel.Tags.Find(key); v != "" {
			route.tags[key] = v
		}
	}
	for _, m := range rel.Members {
		switch {
		case m.Type == osm.TypeWay && !isPlatform(m.Role):
			route.ways = append(route.ways, osm.WayID(m.Ref))
			r.wayNodes[osm.WayID(m.Ref)] = nil
		case m.Type == osm.TypeNode:
			route.nodes = append(route.nodes, member{Type: "node", Ref: m.Ref, Role: m.Role})
			r.stops[m.Ref] = element{}
		}
	}
	if len(route.ways) > 0 {
		r.routes = append(r.routes, route)
	}
}

// addWay keeps the nodes of w when a route runs along it.
func (r *osmBusReader) addWay(w *osm.Way) {
	if _, ok := r.wayNodes[w.ID]; !ok {
		return
	}
	nodes := make([]osm.NodeID, 0, len(w.Nodes))
	for _, n := range w.Nodes {
		nodes = append(nodes, n.ID)
		r.spots[n.ID] = [2]float64{}
	}
	r.wayNodes[w.ID] = nodes
}

// addNode keeps n's spot when a route's way runs through it, and its name
// when it's a route's stop.
func (r *osmBusReader) addNode(n *osm.Node) {
	if _, ok := r.spots[n.ID]; ok {
		r.spots[n.ID] = [2]float64{n.Lon, n.Lat}
	}
	if _, ok := r.stops[int64(n.ID)]; ok {
		r.stops[int64(n.ID)] = element{
			Type: "node", ID: int64(n.ID), Lat: n.Lat, Lon: n.Lon,
			Tags: map[string]string{"name": n.Tags.Find("name"), "name:en": n.Tags.Find("name:en")},
		}
	}
}

// busMap is the routes gathered as a bus map: each way once, and each route
// with the ways it runs along and its stops in order. A way or stop outside
// the extract is left out.
func (r *osmBusReader) busMap() busMap {
	m := busMap{Ways: [][][2]float64{}, Routes: []busRoute{}}
	index := map[osm.WayID]int{}
	stops := map[int64]element{}
	for id, e := range r.stops {
		if e.ID != 0 {
			stops[id] = e
		}
	}
	for _, rel := range r.routes {
		route := busRoute{ID: rel.id, Tags: rel.tags}
		for _, id := range rel.ways {
			i, ok := index[id]
			if !ok {
				i = len(m.Ways)
				index[id] = i
				m.Ways = append(m.Ways, r.wayPoints(id))
			}
			if len(m.Ways[i]) >= 2 {
				route.Ways = append(route.Ways, i)
			}
		}
		if len(route.Ways) == 0 {
			continue
		}
		route.Stops = stopsOf(element{Members: rel.nodes}, stops)
		m.Routes = append(m.Routes, route)
	}
	return m
}

// wayPoints are the spots way id runs through, leaving out nodes outside the
// extract.
func (r *osmBusReader) wayPoints(id osm.WayID) [][2]float64 {
	var out [][2]float64
	for _, n := range r.wayNodes[id] {
		if p, ok := r.spots[n]; ok && p != ([2]float64{}) {
			out = append(out, p)
		}
	}
	return out
}

// readOSMBus reads an extract's bus routes from open, which opens the
// .osm.pbf file afresh for each of its three passes.
func readOSMBus(ctx context.Context, open func() (io.ReadCloser, error)) (busMap, error) {
	r := newOSMBusReader()
	passes := []struct {
		kind osm.Type
		each func(osm.Object)
	}{
		{osm.TypeRelation, func(o osm.Object) {
			if rel, ok := o.(*osm.Relation); ok {
				r.addRelation(rel)
			}
		}},
		{osm.TypeWay, func(o osm.Object) {
			if w, ok := o.(*osm.Way); ok {
				r.addWay(w)
			}
		}},
		{osm.TypeNode, func(o osm.Object) {
			if n, ok := o.(*osm.Node); ok {
				r.addNode(n)
			}
		}},
	}
	for _, pass := range passes {
		if err := scanPBF(ctx, open, pass.kind, pass.each); err != nil {
			return busMap{}, err
		}
	}
	return r.busMap(), nil
}
