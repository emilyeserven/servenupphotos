package github

import (
	"context"
	"encoding/json"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// attentionDropped are the photo file fields the Dashboard's Needs attention
// never reads, left out of Attention's answer to keep it small. colors is
// cut down to its peakChroma instead (see attentionColors).
var attentionDropped = []string{
	"images", "exifOriginals", "notes", "comment", "altText",
	"pickedSimilar", "pickedSimilarNotes", "similarPhotos",
}

// Attention reads every photo JSON file as SocialCalendar does, but with
// each photo's Data cut down to the fields the Dashboard's Needs attention
// counts from: no image URLs, EXIF originals or notes, and colors only as
// its peakChroma. That makes the answer a fraction of the Instagram
// calendar's. It changes nothing.
func (c *Client) Attention(ctx context.Context, gh settings.GitHub) (SocialCalendar, error) {
	return c.socialCalendar(ctx, gh, attentionData)
}

// attentionData is a photo file without the fields Needs attention doesn't
// read.
func attentionData(content []byte) (json.RawMessage, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(content, &fields); err != nil {
		return nil, err
	}
	for _, key := range attentionDropped {
		delete(fields, key)
	}
	if colors, ok := attentionColors(fields["colors"]); ok {
		fields["colors"] = colors
	} else {
		delete(fields, "colors")
	}
	return json.Marshal(fields)
}

// attentionColors is colors with only its peakChroma, which tells colors
// read before peakChroma from current ones; false when it has none.
func attentionColors(colors json.RawMessage) (json.RawMessage, bool) {
	var parts struct {
		PeakChroma json.RawMessage `json:"peakChroma"`
	}
	if json.Unmarshal(colors, &parts) != nil || parts.PeakChroma == nil {
		return nil, false
	}
	out, err := json.Marshal(parts)
	return out, err == nil
}
