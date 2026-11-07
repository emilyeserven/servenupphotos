package transit

import (
	"cmp"
	"context"
	"fmt"
	"strings"
)

// Stop is a station or stop on a line, where a hop can get on or off.
type Stop struct {
	// Name is the stop's name, such as "Namba"; "Stop 3" when it has none.
	Name      string  `json:"name"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// Stops are line id's stations or stops, in the order the line runs, each
// named once even when it's mapped as more than one point.
func (c *Client) Stops(ctx context.Context, id int64) ([]Stop, error) {
	elements, err := c.query(ctx, fmt.Sprintf("[out:json][timeout:25];rel(%d);out body;node(r);out body;", id))
	if err != nil {
		return nil, err
	}
	rel, nodes := splitElements(elements, id)
	if rel == nil {
		return nil, ErrNoTrack
	}
	return stopsOf(*rel, nodes), nil
}

// splitElements finds relation id among elements, and the nodes by ID.
func splitElements(elements []element, id int64) (*element, map[int64]element) {
	var rel *element
	nodes := map[int64]element{}
	for i, e := range elements {
		switch {
		case e.Type == "relation" && e.ID == id:
			rel = &elements[i]
		case e.Type == "node":
			nodes[e.ID] = e
		}
	}
	return rel, nodes
}

// stopsOf are rel's stop nodes in order (its platforms when it marks no
// stops), with a name repeated back to back kept once.
func stopsOf(rel element, nodes map[int64]element) []Stop {
	out := stopsWithRole(rel, nodes, "stop")
	if len(out) == 0 {
		out = stopsWithRole(rel, nodes, "platform")
	}
	return out
}

// stopsWithRole are rel's nodes whose role starts with role, in order.
func stopsWithRole(rel element, nodes map[int64]element, role string) []Stop {
	out := []Stop{}
	for _, m := range rel.Members {
		n, ok := nodes[m.Ref]
		if m.Type != "node" || !ok || !strings.HasPrefix(m.Role, role) {
			continue
		}
		name := cmp.Or(n.Tags["name"], n.Tags["name:en"], fmt.Sprintf("Stop %d", len(out)+1))
		if len(out) > 0 && out[len(out)-1].Name == name {
			continue
		}
		out = append(out, Stop{Name: name, Latitude: n.Lat, Longitude: n.Lon})
	}
	return out
}
