package transit

import (
	"cmp"
	"context"
	"fmt"
	"slices"
)

// nearM is how far, in meters, a line's track can pass from a spot and still
// count as serving it: a photo is often taken outside the station.
const nearM = 500

// maxLines is the most lines Lines answers.
const maxLines = 40

// Lines are the lines of mode's kinds whose track passes near both from and
// to, each [longitude, latitude], sorted by number and name.
func (c *Client) Lines(ctx context.Context, mode string, from, to [2]float64) ([]Line, error) {
	kinds, ok := routeKinds[mode]
	if !ok {
		return nil, ErrNoKind
	}
	elements, err := c.query(ctx, linesQuery(kinds, from, to))
	if err != nil {
		return nil, err
	}
	lines := make([]Line, 0, len(elements))
	for _, e := range elements {
		lines = append(lines, lineOf(e))
	}
	slices.SortFunc(lines, func(a, b Line) int {
		return cmp.Or(cmp.Compare(a.Ref, b.Ref), cmp.Compare(a.Name, b.Name), cmp.Compare(a.ID, b.ID))
	})
	if len(lines) > maxLines {
		lines = lines[:maxLines]
	}
	return lines, nil
}

// linesQuery is the Overpass QL for route relations of kinds (a regex
// alternation) with a way near both from and to.
func linesQuery(kinds string, from, to [2]float64) string {
	return fmt.Sprintf(`[out:json][timeout:25];
way(around:%d,%f,%f)->.w1;
rel(bw.w1)[type=route][route~"^(%s)$"]->.a;
way(around:%d,%f,%f)->.w2;
rel(bw.w2)[type=route][route~"^(%s)$"]->.b;
rel.a.b;
out tags;`, nearM, from[1], from[0], kinds, nearM, to[1], to[0], kinds)
}

// lineOf is the route relation e as a Line, named by its name, or else its
// number, or else its ID.
func lineOf(e element) Line {
	t := e.Tags
	name := cmp.Or(t["name"], t["name:en"], t["ref"], fmt.Sprintf("Line %d", e.ID))
	return Line{ID: e.ID, Name: name, Ref: t["ref"], Colour: t["colour"], Kind: t["route"], From: t["from"], To: t["to"]}
}
