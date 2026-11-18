package transit

import (
	"cmp"
	"container/heap"
	"context"
	"errors"
	"math"
	"slices"
	"strings"
	"sync"
)

// A rail map is a country's railways as one network (see railNet), read from
// files downloaded once: Japan's from MLIT (mlit.go), any other country's from
// OpenStreetMap's extracts (osmrail.go). Its look-ups are the same whatever
// it was read from.

// routeBits is how many bits of a route's ID each of its lines takes.
const routeBits = 12

// railRouteM is how far from each end, in meters, a route along a rail map
// starts and ends: an end is often outside its station.
const railRouteM = 1000

// railModes are the modes rail maps have lines for: their railways don't tell
// subways apart.
var railModes = map[string]bool{"train": true, "subway": true}

// RailMapError is a rail map not being there to look in: its download failed
// or is still running, or its files couldn't be read.
type RailMapError struct {
	// Map names the rail map, such as "Japan's rail map".
	Map string
	// Err is what went wrong.
	Err error
}

// Error says which rail map isn't ready and why.
func (e *RailMapError) Error() string {
	return e.Map + " isn't ready: " + e.Err.Error()
}

// Unwrap is what went wrong.
func (e *RailMapError) Unwrap() error { return e.Err }

// errRailDownloading is a look-up not waiting for the whole download.
var errRailDownloading = errors.New("it's still downloading, once; try again in a minute")

// railNets loads each rail map once, by key, keeping it for every look-up
// after.
type railNets struct {
	mu    sync.Mutex
	loads map[string]*railLoad
}

// railLoad is one rail map: loaded, or loading until busy closes, or failed.
type railLoad struct {
	net  *railNet
	busy chan struct{}
	err  error
}

// get is the rail map named name, kept as key, loading it with load first
// when needed. A look-up waits for the load as long as ctx allows; the load
// goes on without it. A failed load is tried again on the next look-up.
func (r *railNets) get(ctx context.Context, key, name string, load func() (*railNet, error)) (*railNet, error) {
	r.mu.Lock()
	if r.loads == nil {
		r.loads = map[string]*railLoad{}
	}
	l := r.loads[key]
	if l == nil {
		l = &railLoad{}
		r.loads[key] = l
	}
	if l.net != nil {
		defer r.mu.Unlock()
		return l.net, nil
	}
	if l.busy == nil {
		l.busy = make(chan struct{})
		go r.load(l, l.busy, load)
	}
	busy := l.busy
	r.mu.Unlock()
	select {
	case <-busy:
	case <-ctx.Done():
		return nil, &RailMapError{Map: name, Err: errRailDownloading}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if l.net == nil {
		return nil, &RailMapError{Map: name, Err: l.err}
	}
	return l.net, nil
}

// load runs load for l and closes done, keeping the network or why it
// couldn't be loaded.
func (r *railNets) load(l *railLoad, done chan struct{}, load func() (*railNet, error)) {
	net, err := load()
	r.mu.Lock()
	l.net, l.err, l.busy = net, err, nil
	r.mu.Unlock()
	close(done)
}

// railLines are, from net, the route along its lines from from to to, each
// [longitude, latitude], changing lines where it has to, and then each line
// passing within nearM of both ends.
func railLines(net *railNet, from, to [2]float64) []Line {
	lines := []Line{}
	if r, ok := net.routeLine(from, to); ok {
		lines = append(lines, r)
	}
	for _, l := range net.linesNearBoth(from, to) {
		if len(lines) == 0 || lines[0].ID != l.ID {
			lines = append(lines, l)
		}
	}
	return lines[:min(len(lines), maxLines)]
}

// railTrack is route id's track on net from the point on its lines nearest
// from to the point nearest to, with from and to added at its ends, as Track
// is.
func railTrack(net *railNet, id int64, from, to [2]float64) ([][2]float64, error) {
	allowed, err := net.routeLines(id)
	if err != nil {
		return nil, ErrNoTrack
	}
	a, b := net.nearestOn(from, allowed), net.nearestOn(to, allowed)
	if a < 0 || b < 0 {
		return nil, ErrNoTrack
	}
	nodes, _ := net.route(a, b, allowed)
	if len(nodes) < 2 {
		return nil, ErrNoTrack
	}
	path := make([][2]float64, 0, len(nodes)+2)
	path = append(path, from)
	for _, node := range nodes {
		path = append(path, net.points[node])
	}
	return append(path, to), nil
}

// railStops are route id's stations on net, in the order its track runs from
// its station farthest from the others, each name once.
func railStops(net *railNet, id int64) ([]Stop, error) {
	allowed, err := net.routeLines(id)
	if err != nil {
		return nil, ErrNoTrack
	}
	return net.stopsAlong(allowed), nil
}

// routeLine is the route along the lines from near from to near to, as a Line
// named by the lines it rides; false when there's none, or it rides more than
// maxRouteLines lines.
func (n *railNet) routeLine(from, to [2]float64) (Line, bool) {
	a, b := n.nearestOn(from, nil), n.nearestOn(to, nil)
	if a < 0 || b < 0 {
		return Line{}, false
	}
	_, edgeLines := n.route(a, b, nil)
	ridden := n.ridden(edgeLines)
	if len(ridden) == 0 || len(ridden) > n.maxLines() {
		return Line{}, false
	}
	return n.lineOf(ridden), true
}

// ridden are the lines of a route's edges in the order it rides them, each
// stretch on one line once, leaving out the changes between stations and the
// unnamed track joining lines.
func (n *railNet) ridden(edgeLines []int) []int {
	var out []int
	for _, l := range edgeLines {
		if !n.unnamed(l) && (len(out) == 0 || out[len(out)-1] != l) {
			out = append(out, l)
		}
	}
	return out
}

// linesNearBoth are the lines with track within nearM of both from and to,
// sorted by name.
func (n *railNet) linesNearBoth(from, to [2]float64) []Line {
	there := n.linesNear(to, nearM)
	var out []Line
	for l := range n.linesNear(from, nearM) {
		if there[l] && !n.unnamed(l) {
			out = append(out, n.lineOf([]int{l}))
		}
	}
	slices.SortFunc(out, func(a, b Line) int { return cmp.Or(cmp.Compare(a.Name, b.Name), cmp.Compare(a.From, b.From)) })
	return out
}

// lineOf is lines ridden one after another as a Line, named by their names
// joined with arrows, such as "山陽線 → 山陰線", with its ID holding them and
// the network's own part of the ID.
func (n *railNet) lineOf(lines []int) Line {
	names := make([]string, 0, len(lines))
	var operators []string
	for _, l := range lines {
		names = append(names, n.lines[l].name)
		if op := n.lines[l].operator; !slices.Contains(operators, op) {
			operators = append(operators, op)
		}
	}
	return Line{
		ID: n.idBase | routeID(lines), Name: strings.Join(names, " → "), Kind: railKind(n.lines[lines[0]].kind),
		From: strings.Join(strings.Fields(strings.Join(operators, " ")), " "), Source: n.source,
	}
}

// routeID holds lines' indexes, first line lowest, each plus one so a route
// of one line 0 isn't ID 0.
func routeID(lines []int) int64 {
	var id int64
	for i, l := range lines {
		id |= int64(l+1) << (routeBits * i)
	}
	return id
}

// errBadRouteID is an ID that holds no line of the rail map.
var errBadRouteID = errors.New("not a line of this rail map")

// routeLines are the lines id holds, as a set, leaving out the network's own
// part of the ID.
func (n *railNet) routeLines(id int64) (map[int]bool, error) {
	out := map[int]bool{}
	for id &= 1<<n.lineBits - 1; id > 0; id >>= routeBits {
		l := int(id&(1<<routeBits-1)) - 1
		if l < 0 || l >= len(n.lines) {
			return nil, errBadRouteID
		}
		out[l] = true
	}
	if len(out) == 0 {
		return nil, errBadRouteID
	}
	return out, nil
}

// maxLines is the most lines a route's ID can hold.
func (n *railNet) maxLines() int {
	return n.lineBits / routeBits
}

// railKinds are the OpenStreetMap kinds the rail map's kinds of railway are
// shown as: 14, 15, 22 and 23 monorails, 16 and 24 guided ones as light rail,
// 21 tramways, and 31, which only OpenStreetMap's rail maps use, subways; any
// other, such as 11 for JR lines, as trains.
var railKinds = map[int]string{14: "monorail", 15: "monorail", 22: "monorail", 23: "monorail", 16: "light_rail", 24: "light_rail", 21: "tram", 31: "subway"}

// railKind is how kind is shown.
func railKind(kind int) string {
	return cmp.Or(railKinds[kind], "train")
}

// stopsAlong are the stations of allowed's lines, ordered by how far along the
// track each is from the one farthest from their middle, each name once.
func (n *railNet) stopsAlong(allowed map[int]bool) []Stop {
	var on []railStation
	for _, s := range n.stations {
		if allowed[s.line] {
			on = append(on, s)
		}
	}
	if len(on) == 0 {
		return []Stop{}
	}
	along := n.distancesFrom(n.farthestStation(on).node, allowed)
	far := func(s railStation) float64 {
		if d, ok := along[s.node]; ok {
			return d
		}
		return math.Inf(1)
	}
	slices.SortStableFunc(on, func(a, b railStation) int { return cmp.Compare(far(a), far(b)) })
	out := []Stop{}
	seen := map[string]bool{}
	for _, s := range on {
		if !seen[s.name] {
			p := n.points[s.node]
			out = append(out, Stop{Name: s.name, Latitude: p[1], Longitude: p[0]})
		}
		seen[s.name] = true
	}
	return out
}

// farthestStation is the station of on farthest from their middle: one end of
// the line.
func (n *railNet) farthestStation(on []railStation) railStation {
	spots := make([][2]float64, 0, len(on))
	for _, s := range on {
		spots = append(spots, n.points[s.node])
	}
	mid := middle([][][2]float64{spots})
	return slices.MaxFunc(on, func(a, b railStation) int {
		return cmp.Compare(meters(n.points[a.node], mid), meters(n.points[b.node], mid))
	})
}

// distancesFrom are how far each node is along allowed's track from node a;
// nodes it doesn't reach are left out, and sort last.
func (n *railNet) distancesFrom(a int, allowed map[int]bool) map[int]float64 {
	dist := map[int]float64{a: 0}
	q := &railQueue{{railState{a, changeEdge}, 0}}
	for q.Len() > 0 {
		it := heap.Pop(q).(railItem) //nolint:forcetypeassert // the queue only holds railItems
		if it.dist > dist[it.state.node] {
			continue
		}
		for _, e := range n.edges[it.state.node] {
			if !allows(allowed, e.line) {
				continue
			}
			if old, ok := dist[e.to]; !ok || it.dist+e.meters < old {
				dist[e.to] = it.dist + e.meters
				heap.Push(q, railItem{railState{e.to, e.line}, it.dist + e.meters})
			}
		}
	}
	return dist
}
