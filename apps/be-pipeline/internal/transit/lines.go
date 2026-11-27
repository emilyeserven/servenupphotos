package transit

import (
	"cmp"
	"fmt"
)

// nearM is how far, in meters, a line's track can pass from a spot and still
// count as serving it: a photo is often taken outside the station.
const nearM = 500

// maxLines is the most lines a rail or bus map look-up answers.
const maxLines = 40

// lineOf is the route relation e as a Line, named by its name, or else its
// number, or else its ID.
func lineOf(e element) Line {
	t := e.Tags
	name := cmp.Or(t["name"], t["name:en"], t["ref"], fmt.Sprintf("Line %d", e.ID))
	return Line{ID: e.ID, Name: name, Ref: t["ref"], Colour: t["colour"], Kind: t["route"], From: t["from"], To: t["to"]}
}
