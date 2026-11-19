package transit

import (
	"container/heap"
	"math"
	"slices"
)

// railNet is Japan's rail map as one network: each point of a line's track a
// node, joined to the points next to it along the line, and stations of one
// name a short walk apart joined to each other, so a ride can change lines
// there.
type railNet struct {
	lines  []railLine
	points [][2]float64
	edges  [][]railEdge
	// index finds a point's node by its spot rounded to about a meter, so
	// sections and lines meeting at one spot share it.
	index map[[2]int32]int
	// cells are the nodes in each grid cell of cellDeg degrees, to find the
	// ones near a spot quickly.
	cells map[[2]int32][]int
	// stations are the named stations, each on its line.
	stations []railStation
	// source is the Line.Source of its lines, such as "mlit".
	source string
	// idBase is the part of its routes' IDs that names the network, such as
	// the OpenStreetMap extract it was read from; 0 for Japan's rail map.
	idBase int64
	// lineBits is how many of its routes' IDs' bits hold their lines.
	lineBits int
}

// railLine is one line of one operator, such as 山陰線 of 西日本旅客鉄道.
type railLine struct {
	name     string
	operator string
	kind     int
}

// railEdge joins a node to the next one along line, or to a station of the
// same name on another line when line is changeEdge.
type railEdge struct {
	to     int
	meters float64
	line   int
}

// railStation is a station on a line, at the node of that line nearest it.
type railStation struct {
	name string
	line int
	node int
}

// detourLimit is how many times the straight distance a route may run before
// the search gives up on it, so a search doesn't cover the whole country.
const detourLimit = 3

// changeEdge is the line of an edge between two stations of one name.
const changeEdge = -1

// cellDeg is the size of a grid cell, in degrees: about a kilometer.
const cellDeg = 0.01

// changeWalkM is how far apart two stations of one name can be and still be
// one place to change lines at.
const changeWalkM = 500

// changePenaltyM is how much farther, in meters, a route counts each change of
// line as, so it stays on one line where it can, as a ride does.
const changePenaltyM = 20_000

// newRailNet builds the network of lines' sections and their stations.
func newRailNet(sections, stations []mlitFeature) *railNet {
	n := &railNet{index: map[[2]int32]int{}, cells: map[[2]int32][]int{}}
	ids := map[[2]string]int{}
	lineNodes := map[int][]int{}
	for _, f := range sections {
		line := n.lineID(ids, f)
		for _, part := range f.Geometry.lines() {
			lineNodes[line] = append(lineNodes[line], n.addPart(part, line)...)
		}
	}
	for _, f := range stations {
		line, ok := ids[[2]string{f.Properties.Operator, f.Properties.Line}]
		if !ok || f.Properties.Station == "" {
			continue
		}
		if node := n.nearestOf(lineNodes[line], middle(f.Geometry.lines())); node >= 0 {
			n.stations = append(n.stations, railStation{f.Properties.Station, line, node})
		}
	}
	n.joinStations()
	return n
}

// lineID is the index of f's line, added when it's new.
func (n *railNet) lineID(ids map[[2]string]int, f mlitFeature) int {
	key := [2]string{f.Properties.Operator, f.Properties.Line}
	if id, ok := ids[key]; ok {
		return id
	}
	kind, _ := f.Properties.Type.Int64()
	ids[key] = len(n.lines)
	n.lines = append(n.lines, railLine{f.Properties.Line, f.Properties.Operator, int(kind)})
	return len(n.lines) - 1
}

// addPart adds part's points as nodes joined along line, and says which.
func (n *railNet) addPart(part [][2]float64, line int) []int {
	nodes := make([]int, 0, len(part))
	prev := -1
	for _, p := range part {
		node := n.node(p)
		if prev >= 0 && prev != node {
			n.join(prev, node, line)
		}
		nodes = append(nodes, node)
		prev = node
	}
	return nodes
}

// node is p's node, added when it's new.
func (n *railNet) node(p [2]float64) int {
	key := [2]int32{int32(math.Round(p[0] * 1e5)), int32(math.Round(p[1] * 1e5))}
	if id, ok := n.index[key]; ok {
		return id
	}
	id := len(n.points)
	n.index[key] = id
	n.points = append(n.points, p)
	n.edges = append(n.edges, nil)
	cell := cellOf(p)
	n.cells[cell] = append(n.cells[cell], id)
	return id
}

// join adds the edge between a and b, both ways.
func (n *railNet) join(a, b, line int) {
	d := meters(n.points[a], n.points[b])
	n.edges[a] = append(n.edges[a], railEdge{b, d, line})
	n.edges[b] = append(n.edges[b], railEdge{a, d, line})
}

// joinStations joins each two stations of one name on different lines within
// changeWalkM of each other, where a ride can change between them.
func (n *railNet) joinStations() {
	byName := map[string][]railStation{}
	for _, s := range n.stations {
		byName[s.name] = append(byName[s.name], s)
	}
	for _, same := range byName {
		for i, a := range same {
			for _, b := range same[i+1:] {
				if a.line != b.line && a.node != b.node && meters(n.points[a.node], n.points[b.node]) <= changeWalkM {
					n.join(a.node, b.node, changeEdge)
				}
			}
		}
	}
}

// cellOf is the grid cell p is in.
func cellOf(p [2]float64) [2]int32 {
	return [2]int32{int32(math.Floor(p[0] / cellDeg)), int32(math.Floor(p[1] / cellDeg))}
}

// middle is the middle point of lines' points; the zero spot with none.
func middle(lines [][][2]float64) [2]float64 {
	var sum [2]float64
	count := 0
	for _, line := range lines {
		for _, p := range line {
			sum[0], sum[1] = sum[0]+p[0], sum[1]+p[1]
			count++
		}
	}
	if count == 0 {
		return sum
	}
	return [2]float64{sum[0] / float64(count), sum[1] / float64(count)}
}

// nearestOf is the node of nodes nearest p; -1 with none.
func (n *railNet) nearestOf(nodes []int, p [2]float64) int {
	best, bestD := -1, math.Inf(1)
	for _, node := range nodes {
		if d := meters(n.points[node], p); d < bestD {
			best, bestD = node, d
		}
	}
	return best
}

// near are the nodes within m meters of p, m at most about a kilometer.
func (n *railNet) near(p [2]float64, m float64) []int {
	c := cellOf(p)
	var out []int
	for dx := int32(-1); dx <= 1; dx++ {
		for dy := int32(-1); dy <= 1; dy++ {
			for _, node := range n.cells[[2]int32{c[0] + dx, c[1] + dy}] {
				if meters(n.points[node], p) <= m {
					out = append(out, node)
				}
			}
		}
	}
	return out
}

// linesNear are the lines with track within m meters of p.
func (n *railNet) linesNear(p [2]float64, m float64) map[int]bool {
	out := map[int]bool{}
	for _, node := range n.near(p, m) {
		for _, e := range n.edges[node] {
			if e.line != changeEdge {
				out[e.line] = true
			}
		}
	}
	return out
}

// ends are the nodes within railRouteM of p on one of allowed's lines (any
// line when allowed is nil), each with what walking to it from p counts as.
func (n *railNet) ends(p [2]float64, allowed map[int]bool) map[int]float64 {
	out := map[int]float64{}
	for _, node := range n.near(p, railRouteM) {
		if slices.ContainsFunc(n.edges[node], func(e railEdge) bool { return e.line != changeEdge && allows(allowed, e.line) }) {
			out[node] = walkFactor * meters(n.points[node], p)
		}
	}
	return out
}

// allows reports whether line is one of allowed, or any line when allowed is
// nil. Changing between stations is always allowed.
func allows(allowed map[int]bool, line int) bool {
	return allowed == nil || line == changeEdge || allowed[line]
}

// railState is a node reached on a line, so that leaving it on another line
// counts as a change.
type railState struct {
	node, line int
}

// railStep is how a state was reached: the state before it.
type railStep struct {
	dist float64
	prev railState
}

// route is the shortest way along allowed's lines (any when nil) from near
// from to near to, each change of line counting changePenaltyM more: its nodes
// and the line of each edge between them. It may start and end on any track
// within railRouteM of each end, so an end between two railways, such as
// 電鉄出雲市 beside JR's 出雲市, starts on whichever one goes there. Nil when
// there's no such way.
func (n *railNet) route(from, to [2]float64, allowed map[int]bool) (nodes, lines []int) {
	goals := n.ends(to, allowed)
	s := railSearch{
		best:  map[railState]railStep{},
		queue: &railQueue{},
		limit: detourLimit*meters(from, to) + 4*changePenaltyM + 2*walkFactor*railRouteM,
	}
	for node, walk := range n.ends(from, allowed) {
		start := railState{node, changeEdge}
		s.reach(start, start, walk)
	}
	for s.queue.Len() > 0 {
		it := heap.Pop(s.queue).(railItem) //nolint:forcetypeassert // the queue only holds railItems
		if it.dist > s.best[it.state].dist {
			continue
		}
		if it.state == arrived {
			return n.walkBack(s.best, s.best[arrived].prev)
		}
		if walk, ok := goals[it.state.node]; ok {
			s.reach(arrived, it.state, it.dist+walk)
		}
		for _, e := range n.edges[it.state.node] {
			if allows(allowed, e.line) {
				s.reach(railState{e.to, e.line}, it.state, it.dist+e.meters*n.speedFactor(e.line)+n.changeCost(it.state.line, e.line))
			}
		}
	}
	return nil, nil
}

// arrived is the state of a route that has walked from its last node to its
// end.
var arrived = railState{-1, changeEdge}

// walkFactor is how many meters of track each meter walked between an end and
// the track counts as, so a route rides as near each end as it can.
const walkFactor = 3

// railSearch is a route's search: the shortest way found to each state, the
// states waiting to be gone on from, and how far it may go.
type railSearch struct {
	best  map[railState]railStep
	queue *railQueue
	limit float64
}

// reach keeps next as reached from prev at dist when that's within the limit
// and shorter than any way found to it before.
func (s *railSearch) reach(next, prev railState, dist float64) {
	if dist > s.limit {
		return
	}
	if old, ok := s.best[next]; ok && old.dist <= dist {
		return
	}
	s.best[next] = railStep{dist, prev}
	heap.Push(s.queue, railItem{next, dist})
}

// highSpeedFactor is how much of each meter of high-speed track a route
// counts, so a ride between two cities takes the high-speed line, as the
// KTX from Seoul to Busan does, rather than the slower line beside it that
// is a little shorter once a change of line is counted.
const highSpeedFactor = 0.6

// speedFactor is how much of each meter along line a route counts: less on
// a high-speed line.
func (n *railNet) speedFactor(line int) float64 {
	if line >= 0 && n.lines[line].kind == highSpeedKind {
		return highSpeedFactor
	}
	return 1
}

// changeCost is the extra cost of going on along line after arriving on prev:
// changePenaltyM when it's another line, and nothing at the start or onto or
// off unnamed track, which only joins lines.
func (n *railNet) changeCost(prev, line int) float64 {
	if prev == line || n.unnamed(prev) || n.unnamed(line) {
		return 0
	}
	return changePenaltyM
}

// unnamed reports whether line is no named line: a change between stations,
// or track OpenStreetMap gives no name, such as a connecting curve.
func (n *railNet) unnamed(line int) bool {
	return line == changeEdge || n.lines[line].name == ""
}

// walkBack is the route ending at end, back to the state it started at: its
// nodes and the line of each edge.
func (n *railNet) walkBack(best map[railState]railStep, end railState) (nodes, lines []int) {
	s := end
	for ; best[s].prev != s; s = best[s].prev {
		nodes = append(nodes, s.node)
		lines = append(lines, s.line)
	}
	nodes = append(nodes, s.node)
	slices.Reverse(nodes)
	slices.Reverse(lines)
	return nodes, lines
}

// railItem is a state waiting in the queue, with its distance so far.
type railItem struct {
	state railState
	dist  float64
}

// railQueue is a min-heap of railItems by distance.
type railQueue []railItem

func (q railQueue) Len() int           { return len(q) }
func (q railQueue) Less(i, j int) bool { return q[i].dist < q[j].dist }
func (q railQueue) Swap(i, j int)      { q[i], q[j] = q[j], q[i] }
func (q *railQueue) Push(x any)        { *q = append(*q, x.(railItem)) } //nolint:forcetypeassert // only railItems are pushed
func (q *railQueue) Pop() any {
	old := *q
	it := old[len(old)-1]
	*q = old[:len(old)-1]
	return it
}
