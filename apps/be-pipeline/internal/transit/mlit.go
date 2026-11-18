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

// SourceMLIT is the Line.Source of a line found on Japan's rail map.
const SourceMLIT = "mlit"

// maxRouteLines is the most lines one route of Japan's rail map can ride: its
// ID holds each line's index in routeBits bits.
const maxRouteLines = 5

// routeBits is how many bits of a route's ID each of its lines takes.
const routeBits = 12

// mlitRouteM is how far from each end, in meters, a route along the rail map
// starts and ends: an end is often outside its station.
const mlitRouteM = 1000

// railMap loads Japan's rail map once, downloading it the first time.
type railMap struct {
	mu   sync.Mutex
	net  *railNet
	busy chan struct{}
	err  error
}

// rail is the rail map's network, downloading and reading it first when
// needed. A look-up waits for the download as long as ctx allows; the download
// goes on without it.
func (c *Client) rail(ctx context.Context) (*railNet, error) {
	m := &c.Rail
	m.mu.Lock()
	if m.net != nil {
		defer m.mu.Unlock()
		return m.net, nil
	}
	if m.busy == nil {
		m.busy = make(chan struct{})
		go c.loadRail(m.busy)
	}
	busy := m.busy
	m.mu.Unlock()
	select {
	case <-busy:
	case <-ctx.Done():
		return nil, &MLITError{Err: errMLITDownloading}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.net == nil {
		return nil, &MLITError{Err: m.err}
	}
	return m.net, nil
}

// loadRail downloads the rail map when it isn't there, reads it, and closes
// done, keeping the network or why it couldn't be loaded.
func (c *Client) loadRail(done chan struct{}) {
	net, err := c.readRail()
	m := &c.Rail
	m.mu.Lock()
	m.net, m.err, m.busy = net, err, nil
	m.mu.Unlock()
	close(done)
}

// readRail is the rail map's network from its folder, downloaded there first
// when it isn't there yet.
func (c *Client) readRail() (*railNet, error) {
	dir := mlitDir()
	if !haveMLIT(dir) {
		ctx, cancel := context.WithTimeout(context.Background(), mlitDownloadTimeout)
		defer cancel()
		if err := downloadMLIT(ctx, c.HTTP, mlitURL(), dir); err != nil {
			return nil, err
		}
	}
	sections, stations, err := readMLIT(dir)
	if err != nil {
		return nil, err
	}
	return newRailNet(sections, stations), nil
}

// railModes are the modes Japan's rail map has lines for: its railways don't
// tell subways apart.
var railModes = map[string]bool{"train": true, "subway": true}

// MLITLines are, from Japan's rail map, the route along its lines from from to
// to, each [longitude, latitude], changing lines where it has to, and then
// each line passing within nearM of both ends.
func (c *Client) MLITLines(ctx context.Context, mode string, from, to [2]float64) ([]Line, error) {
	if !railModes[mode] {
		return nil, ErrNoKind
	}
	net, err := c.rail(ctx)
	if err != nil {
		return nil, err
	}
	lines := []Line{}
	if r, ok := net.routeLine(from, to); ok {
		lines = append(lines, r)
	}
	for _, l := range net.linesNearBoth(from, to) {
		if len(lines) == 0 || lines[0].ID != l.ID {
			lines = append(lines, l)
		}
	}
	return lines[:min(len(lines), maxLines)], nil
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
	ridden := ridden(edgeLines)
	if len(ridden) == 0 || len(ridden) > maxRouteLines {
		return Line{}, false
	}
	return n.lineOf(ridden), true
}

// ridden are the lines of a route's edges in the order it rides them, each
// stretch on one line once, leaving out the changes between stations.
func ridden(edgeLines []int) []int {
	var out []int
	for _, l := range edgeLines {
		if l != changeEdge && (len(out) == 0 || out[len(out)-1] != l) {
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
		if there[l] {
			out = append(out, n.lineOf([]int{l}))
		}
	}
	slices.SortFunc(out, func(a, b Line) int { return cmp.Or(cmp.Compare(a.Name, b.Name), cmp.Compare(a.From, b.From)) })
	return out
}

// lineOf is lines ridden one after another as a Line, named by their names
// joined with arrows, such as "山陽線 → 山陰線", with its ID holding them.
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
		ID: routeID(lines), Name: strings.Join(names, " → "), Kind: railKind(n.lines[lines[0]].kind),
		From: strings.Join(operators, ", "), Source: SourceMLIT,
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
var errBadRouteID = errors.New("not a line of Japan's rail map")

// routeLines are the lines id holds, as a set.
func (n *railNet) routeLines(id int64) (map[int]bool, error) {
	out := map[int]bool{}
	for ; id > 0; id >>= routeBits {
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

// railKinds are the OpenStreetMap kinds the rail map's kinds of railway are
// shown as: 14, 15, 22 and 23 monorails, 16 and 24 guided ones as light rail,
// and 21 tramways; any other, such as 11 for JR lines, as trains.
var railKinds = map[int]string{14: "monorail", 15: "monorail", 22: "monorail", 23: "monorail", 16: "light_rail", 24: "light_rail", 21: "tram"}

// railKind is how kind is shown.
func railKind(kind int) string {
	return cmp.Or(railKinds[kind], "train")
}

// MLITTrack is route id's track from the point on its lines nearest from to
// the point nearest to, with from and to added at its ends, as Track is.
func (c *Client) MLITTrack(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error) {
	net, err := c.rail(ctx)
	if err != nil {
		return nil, err
	}
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

// MLITStops are route id's stations, in the order its track runs from its
// station farthest from the others, each name once.
func (c *Client) MLITStops(ctx context.Context, id int64) ([]Stop, error) {
	net, err := c.rail(ctx)
	if err != nil {
		return nil, err
	}
	allowed, err := net.routeLines(id)
	if err != nil {
		return nil, ErrNoTrack
	}
	return net.stopsAlong(allowed), nil
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
