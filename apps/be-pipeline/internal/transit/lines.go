package transit

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"
)

// nearM is how far, in meters, a line's track can pass from a spot and still
// count as serving it: a photo is often taken outside the station.
const nearM = 500

// maxLines is the most lines Lines answers.
const maxLines = 40

// Lines are the lines of mode's kinds whose track passes near both from and
// to, each [longitude, latitude], sorted by number and name.
func (c *Client) Lines(ctx context.Context, mode string, from, to [2]float64) ([]Line, error) {
	kind, ok := routeKinds[mode]
	if !ok {
		return nil, ErrNoKind
	}
	elements, err := c.query(ctx, linesQuery(kind, from, to))
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

// linesQuery is the Overpass QL for route relations of kind with a way near
// both from and to. It looks only at the ways kind's lines run on near from,
// rather than every building and path there, and then only at those lines'
// own ways near to, rather than every way near to.
func linesQuery(kind routeKind, from, to [2]float64) string {
	near := fmt.Sprintf("(around:%d,%f,%f)", nearM, from[1], from[0])
	var ways strings.Builder
	for _, tag := range kind.ways {
		ways.WriteString("way" + near + tag + ";")
	}
	return fmt.Sprintf(serverTimeout+`
(%s)->.w1;
rel(bw.w1)[type=route][route~"^(%s)$"]->.a;
way(r.a)(around:%d,%f,%f);
rel(bw)->.b;
rel.a.b;
out tags;`, ways.String(), kind.routes, nearM, to[1], to[0])
}

// lineOf is the route relation e as a Line, named by its name, or else its
// number, or else its ID.
func lineOf(e element) Line {
	t := e.Tags
	name := cmp.Or(t["name"], t["name:en"], t["ref"], fmt.Sprintf("Line %d", e.ID))
	return Line{ID: e.ID, Name: name, Ref: t["ref"], Colour: t["colour"], Kind: t["route"], From: t["from"], To: t["to"]}
}
