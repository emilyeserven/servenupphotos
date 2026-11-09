package transit

import (
	"container/heap"
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
)

// ErrNoTrack is returned when the line's mapped track doesn't join the two
// spots, or the line has no track.
var ErrNoTrack = errors.New("couldn't follow that line between those spots")

// Track is line id's track from the point on it nearest from to the point on
// it nearest to, each [longitude, latitude], with from and to themselves
// added at its ends so it joins the photos.
func (c *Client) Track(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error) {
	elements, err := c.query(ctx, fmt.Sprintf(serverTimeout+"rel(%d);out geom;", id))
	if err != nil {
		return nil, err
	}
	if len(elements) == 0 {
		return nil, ErrNoTrack
	}
	path := newTrackGraph(elements[0].Members).between(from, to)
	if len(path) < 2 {
		return nil, ErrNoTrack
	}
	return append(append([][2]float64{from}, path...), to), nil
}

// trackGraph is a line's ways as a graph: each mapped point a node, joined to
// the points next to it along a way.
type trackGraph struct {
	points [][2]float64
	index  map[[2]float64]int
	edges  [][]int
}

// newTrackGraph builds the graph of members' ways, leaving out platforms.
func newTrackGraph(members []member) *trackGraph {
	var lines [][][2]float64
	for _, m := range members {
		if m.Type != "way" || strings.HasPrefix(m.Role, "platform") {
			continue
		}
		line := make([][2]float64, 0, len(m.Geometry))
		for _, p := range m.Geometry {
			line = append(line, [2]float64{p.Lon, p.Lat})
		}
		lines = append(lines, line)
	}
	return newLinesGraph(lines)
}

// newLinesGraph builds the graph of lines, each point a node joined to the
// points next to it along its line.
func newLinesGraph(lines [][][2]float64) *trackGraph {
	g := &trackGraph{index: map[[2]float64]int{}}
	for _, line := range lines {
		prev := -1
		for _, p := range line {
			n := g.node(p)
			if prev >= 0 && prev != n {
				g.edges[prev] = append(g.edges[prev], n)
				g.edges[n] = append(g.edges[n], prev)
			}
			prev = n
		}
	}
	return g
}

// node is p's node, added when it's new.
func (g *trackGraph) node(p [2]float64) int {
	if n, ok := g.index[p]; ok {
		return n
	}
	g.index[p] = len(g.points)
	g.points = append(g.points, p)
	g.edges = append(g.edges, nil)
	return len(g.points) - 1
}

// nearest is the node closest to p; -1 with no nodes.
func (g *trackGraph) nearest(p [2]float64) int {
	best, bestD := -1, math.Inf(1)
	for n, q := range g.points {
		if d := meters(p, q); d < bestD {
			best, bestD = n, d
		}
	}
	return best
}

// between is the shortest way along the track from the node nearest from to
// the node nearest to; nil when they aren't joined.
func (g *trackGraph) between(from, to [2]float64) [][2]float64 {
	a, b := g.nearest(from), g.nearest(to)
	if a < 0 {
		return nil
	}
	prev := g.shortest(a, b)
	if prev == nil {
		return nil
	}
	var out [][2]float64
	for n := b; n != a; n = prev[n] {
		out = append(out, g.points[n])
	}
	out = append(out, g.points[a])
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}

// shortest runs Dijkstra from a and returns each node's previous node on the
// shortest way, or nil when b can't be reached.
func (g *trackGraph) shortest(a, b int) []int {
	dist := make([]float64, len(g.points))
	prev := make([]int, len(g.points))
	for i := range dist {
		dist[i], prev[i] = math.Inf(1), -1
	}
	dist[a] = 0
	q := &queue{{a, 0}}
	for q.Len() > 0 {
		it := heap.Pop(q).(item) //nolint:forcetypeassert // the queue only holds items
		if it.dist > dist[it.node] {
			continue
		}
		if it.node == b {
			return prev
		}
		for _, n := range g.edges[it.node] {
			if d := it.dist + meters(g.points[it.node], g.points[n]); d < dist[n] {
				dist[n], prev[n] = d, it.node
				heap.Push(q, item{n, d})
			}
		}
	}
	return nil
}

// item is a node waiting in the queue, with its distance so far.
type item struct {
	node int
	dist float64
}

// queue is a min-heap of items by distance.
type queue []item

func (q queue) Len() int           { return len(q) }
func (q queue) Less(i, j int) bool { return q[i].dist < q[j].dist }
func (q queue) Swap(i, j int)      { q[i], q[j] = q[j], q[i] }
func (q *queue) Push(x any)        { *q = append(*q, x.(item)) } //nolint:forcetypeassert // only items are pushed
func (q *queue) Pop() any {
	old := *q
	it := old[len(old)-1]
	*q = old[:len(old)-1]
	return it
}

// meters is the distance between a and b, each [longitude, latitude], on a
// flat map scaled to their latitude: close enough along a line's track.
func meters(a, b [2]float64) float64 {
	scale := math.Cos((a[1] + b[1]) / 2 * math.Pi / 180)
	dx := (a[0] - b[0]) * scale
	dy := a[1] - b[1]
	return math.Hypot(dx, dy) * 111_320
}
