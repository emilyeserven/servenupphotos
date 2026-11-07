package github

import (
	"context"
	"encoding/json"
	"maps"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// rulesKey is the album file field that makes the album a Smart Album.
const rulesKey = "rules"

// The most a Smart Album's rules can hold.
const (
	maxRuleValues    = 200
	maxRuleTextChars = 200
)

// smartRuleKeys are the filters a Smart Album's rules can set, named as the
// portfolio's URL names them: the Grid's places, album, tag, genre and
// chosen photos; its camera, lens, setting, time of day and orientation
// filters; its colors; and the timeline label and the first and last days.
var smartRuleKeys = []string{
	"country", "state", "city", "place", "album", "tag", "genre", "ids",
	"camera", "lens", "cameraGroup", "lensGroup", "iso", "exposure", "focalLength", "aperture", "time", "orientation",
	"color", "match", "min", "vivid", "measure",
	"label", "from", "to",
}

// smartRules is the Smart Album rules in an album file's "rules", or nil when
// it has none or they aren't an object.
func smartRules(raw json.RawMessage) map[string]any {
	var rules map[string]any
	if json.Unmarshal(raw, &rules) != nil || len(rules) == 0 {
		return nil
	}
	return rules
}

// SetAlbumRules saves rules as the album's "rules" in the pending changes,
// making it a Smart Album whose photos are the ones the rules match, or, with
// no rules, writing null to make it an album of chosen photos again. It fails
// when a rule isn't one of smartRuleKeys or its value isn't text, a number,
// or a list of them.
func (c *Client) SetAlbumRules(ctx context.Context, gh settings.GitHub, id string, rules map[string]json.RawMessage) (AlbumsResult, error) {
	if perr := checkSmartRules(rules); perr != nil {
		return AlbumsResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	album, perr := readableAlbum(w.groups()[Albums.Folder], strings.TrimSpace(id))
	if perr != nil {
		return AlbumsResult{}, perr
	}
	if len(rules) == 0 && album.Rules == nil {
		return AlbumsResult{pendingSave: w.pendingSave(nil)}, nil
	}
	value := []byte("null")
	if len(rules) > 0 {
		value, _ = json.Marshal(rules)
	}
	return c.saveAlbumEdits(w, []albumEdit{{album: album, key: rulesKey, value: value}})
}

// checkSmartRules fails when a rule isn't one of smartRuleKeys or its value
// isn't a rule value.
func checkSmartRules(rules map[string]json.RawMessage) *PublishError {
	for _, key := range slices.Sorted(maps.Keys(rules)) {
		if !slices.Contains(smartRuleKeys, key) {
			return publishErr(http.StatusBadRequest, "%q isn't a filter a Smart Album can use.", key)
		}
		if !validRuleValue(rules[key]) {
			return publishErr(http.StatusBadRequest, "The %q filter's value isn't text, a number or a list of them.", key)
		}
	}
	return nil
}

// validRuleValue reports whether raw is a rule's value: non-empty text of up
// to 200 characters, a number, or a non-empty list of up to 200 of them.
func validRuleValue(raw json.RawMessage) bool {
	var list []json.RawMessage
	if json.Unmarshal(raw, &list) == nil {
		return len(list) > 0 && len(list) <= maxRuleValues && !slices.ContainsFunc(list, func(item json.RawMessage) bool {
			return !validRuleScalar(item)
		})
	}
	return validRuleScalar(raw)
}

// validRuleScalar reports whether raw is non-empty text of up to 200
// characters, or a number.
func validRuleScalar(raw json.RawMessage) bool {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text != "" && len([]rune(text)) <= maxRuleTextChars
	}
	var number float64
	return json.Unmarshal(raw, &number) == nil
}
