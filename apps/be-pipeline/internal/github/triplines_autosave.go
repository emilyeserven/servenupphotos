package github

import (
	"encoding/json"
	"net/http"
	"reflect"
)

// refreshAutoLines writes each automatic trip line file again with its
// segments as the photos with changes made draw it, when they differ from the
// ones saved, so the file and TRIPLINES.json keep the line Commit bakes. Each
// file is printed the way oxfmt formats it, since this runs after the other
// changes are formatted.
func (w *workspace) refreshAutoLines(changes map[string][]byte) *PublishError {
	view := w.withChanges(changes)
	spots := view.tripSpots(false)
	for _, e := range view.entries(TripLines) {
		line, ok := autoLineOf(e)
		if !ok {
			continue
		}
		segments := autoSegments(spotsOn(spots, line.Day))
		if reflect.DeepEqual(segments, line.Segments) {
			continue
		}
		line.Segments = segments
		b, err := json.MarshalIndent(line, "", "  ")
		if err != nil {
			return publishErr(http.StatusInternalServerError, "Couldn't encode the trip line of %s.", line.Day)
		}
		changes[e.Path] = formatJSONFile(b)
	}
	return nil
}

// autoLineOf is the trip line in e, when it can be read and is automatic.
func autoLineOf(e Entry) (TripLine, bool) {
	var line TripLine
	if e.Error != "" || json.Unmarshal(e.Data, &line) != nil {
		return line, false
	}
	return line, line.Auto && line.Day != ""
}
