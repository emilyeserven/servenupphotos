package github

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// labelDateLayout is how a timeline label writes its first and last days.
const labelDateLayout = "2006-01-02"

// TimelineLabel is a timeline label file: a name for a run of days, such as
// "Japan" for a trip, which the portfolio's Timeline shows beside the days it
// covers.
type TimelineLabel struct {
	ID string `json:"id"`
	// Name is what the Timeline shows, such as "Japan".
	Name string `json:"name"`
	// Start and End are the first and last days the label covers, both
	// included, written as 2026-09-22.
	Start string `json:"start"`
	End   string `json:"end"`
}

// SaveTimelineLabel saves label as <folder>/timeline/<id>.json, new or
// replacing the one there, in the pending changes. It fails when its days
// overlap another label's, so each day has at most one label.
func (c *Client) SaveTimelineLabel(ctx context.Context, gh settings.GitHub, label TimelineLabel) (EntryResult, error) {
	label, perr := validTimelineLabel(label)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, TimelineLabels, label.ID, label, func(others []Entry) *PublishError {
		return labelOverlap(parseTimelineLabels(others), label)
	})
}

// DeleteTimelineLabel removes the timeline label file named id in the
// pending changes.
func (c *Client) DeleteTimelineLabel(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, TimelineLabels, id, func([]Entry) *PublishError { return nil })
}

// parseTimelineLabels is the timeline labels in entries that can be read.
func parseTimelineLabels(entries []Entry) []TimelineLabel {
	var out []TimelineLabel
	for _, e := range entries {
		var l TimelineLabel
		if json.Unmarshal(e.Data, &l) == nil && l.ID != "" {
			out = append(out, l)
		}
	}
	return out
}

// labelOverlap fails when a label in others covers any of label's days. The
// dates are all written the same way, so they compare as text.
func labelOverlap(others []TimelineLabel, label TimelineLabel) *PublishError {
	for _, o := range others {
		if o.Start <= label.End && label.Start <= o.End {
			return publishErr(http.StatusConflict, "%q already covers %s to %s. Pick days outside it, or change that label first.", o.Name, o.Start, o.End)
		}
	}
	return nil
}

// validTimelineLabel checks l and returns it trimmed, as it will be saved.
func validTimelineLabel(l TimelineLabel) (TimelineLabel, *PublishError) {
	out := TimelineLabel{
		ID: strings.TrimSpace(l.ID), Name: strings.TrimSpace(l.Name),
		Start: strings.TrimSpace(l.Start), End: strings.TrimSpace(l.End),
	}
	if perr := validEntryID(TimelineLabels.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Name == "" {
		return out, publishErr(http.StatusBadRequest, "Give the label a name.")
	}
	if utf8.RuneCountInString(out.Name) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Keep the name to %d characters.", maxEntryTextLength)
	}
	return out, validLabelDays(out)
}

// validLabelDays fails when l's first or last day isn't a date, or its last
// day is before its first.
func validLabelDays(l TimelineLabel) *PublishError {
	_, startErr := time.Parse(labelDateLayout, l.Start)
	_, endErr := time.Parse(labelDateLayout, l.End)
	if startErr != nil || endErr != nil {
		return publishErr(http.StatusBadRequest, "Give the first and last days as dates, such as 2026-09-22.")
	}
	if l.End < l.Start {
		return publishErr(http.StatusBadRequest, "The last day is before the first.")
	}
	return nil
}
