package github

import (
	"bytes"
	"encoding/json"
	"time"
)

// addedField is the photo file field holding when the photo went on the
// portfolio, as an RFC 3339 time in UTC such as "2026-10-25T04:10:22Z": when
// it stopped being a draft (see isDraft), or for a photo that was never one,
// when its file was made. It's null while the photo is a draft. Update Data's
// Missing fields gives older files the time their file was first committed.
const addedField = "addedDate"

// addedTime is t written as a photo file's addedDate.
func addedTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

// awaitingAdded reports a photo file whose addedDate is there but null: a
// photo that hasn't been on the portfolio yet. A file without the field is
// older, and Update Data's Missing fields dates it instead.
func awaitingAdded(content []byte) bool {
	var photo map[string]json.RawMessage
	if json.Unmarshal(content, &photo) != nil {
		return false
	}
	value, ok := photo[addedField]
	return ok && string(bytes.TrimSpace(value)) == "null"
}

// stampAdded is content, a photo file being saved, with its addedDate set to
// now when this save puts it on the portfolio: its addedDate is null and it
// isn't a draft left out of AllPhotosFile. Otherwise content is unchanged, so
// a photo keeps the date it was first added even if it's a draft again later.
func (w *workspace) stampAdded(content []byte, now time.Time) []byte {
	if !awaitingAdded(content) || !w.onPortfolio(content) {
		return content
	}
	value, _ := json.Marshal(addedTime(now))
	stamped, err := setField(content, addedField, value)
	if err != nil {
		return content
	}
	return stamped
}
