package transit

import (
	"context"
	"math"
)

// RouteRide is one line of a route along a rail map that changes lines, such
// as 北松江線 from 電鉄出雲市 to 川跡 on the way to 出雲大社前.
type RouteRide struct {
	// Line is the line ridden, whose ID names it alone.
	Line Line `json:"line"`
	// Path is its track along this ride, each point [longitude, latitude].
	Path [][2]float64 `json:"path"`
	// Change is the station it changed lines at, at the end of this ride;
	// nil on the last ride. A change with no station near is named "".
	Change *Stop `json:"change,omitempty"`
}

// RailRides are route id's lines on the rail map source names ("mlit" or
// "osmrail"), one after another along its track from near from to near to,
// each with its own stretch of the track; none for a route of one line.
func (c *Client) RailRides(ctx context.Context, source string, id int64, from, to [2]float64) ([]RouteRide, error) {
	var net *railNet
	var err error
	switch source {
	case SourceMLIT:
		net, err = c.mlit(ctx)
	case SourceOSMRail:
		net, err = c.osmRailByID(ctx, id)
	default:
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return railRides(net, id, from, to)
}

// railRides are route id's rides on net from near from to near to; none for a
// route of one line.
func railRides(net *railNet, id int64, from, to [2]float64) ([]RouteRide, error) {
	allowed, err := net.routeLines(id)
	if err != nil {
		return nil, ErrNoTrack
	}
	if len(allowed) < 2 {
		return nil, nil
	}
	nodes, lines := net.route(from, to, allowed)
	if len(nodes) == 0 {
		return nil, ErrNoTrack
	}
	rides := net.splitRides(nodes, lines)
	if len(rides) < 2 {
		return nil, nil
	}
	rides[0].Path = append([][2]float64{from}, rides[0].Path...)
	last := &rides[len(rides)-1]
	last.Path = append(last.Path, to)
	return rides, nil
}

// changeNearM is how far, in meters, the station a ride changed lines at can
// be from where the tracks part: lines often part past the platforms, such as
// 山陽線 and 山陰線 about 500 m north of 幡生.
const changeNearM = 1000

// splitRides splits a route's nodes, and the line of each edge between them,
// into one ride for each named line it rides in turn. Unnamed track and the
// walks between stations stay with the ride before them.
func (n *railNet) splitRides(nodes, lines []int) []RouteRide {
	var out []RouteRide
	current := -1
	path := [][2]float64{n.points[nodes[0]]}
	for i, l := range lines {
		named := !n.unnamed(l)
		if named && current >= 0 && l != current {
			out = append(out, RouteRide{Line: n.lineOf([]int{current}), Path: path, Change: n.changeAt(nodes[i], current, l)})
			path = [][2]float64{n.points[nodes[i]]}
		}
		if named {
			current = l
		}
		path = append(path, n.points[nodes[i+1]])
	}
	if current >= 0 {
		out = append(out, RouteRide{Line: n.lineOf([]int{current}), Path: path})
	}
	return out
}

// changeAt is the station nearest node on either line, within changeNearM,
// where a ride changed from one line to the other; the spot unnamed when
// there's none.
func (n *railNet) changeAt(node, from, to int) *Stop {
	at := n.points[node]
	best, bestM := -1, math.Inf(1)
	for i, s := range n.stations {
		if s.line != from && s.line != to {
			continue
		}
		if m := meters(n.points[s.node], at); m <= changeNearM && m < bestM {
			best, bestM = i, m
		}
	}
	if best < 0 {
		return &Stop{Latitude: at[1], Longitude: at[0]}
	}
	s := n.stations[best]
	return &Stop{Name: s.name, Latitude: n.points[s.node][1], Longitude: n.points[s.node][0]}
}
