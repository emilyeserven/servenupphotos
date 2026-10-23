package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// OverrideFields are the photo JSON fields a camera override can set: the
// ones Sanitize reads from EXIF, except the photo's size, and manualAperture.
var OverrideFields = []string{
	"camera", "lens", "aperture", "manualAperture", "exposure", "iso", "focalLength", "gpsPosition", "createDate",
	"country", "city",
}

// exifOriginalsField is the photo JSON field that keeps the EXIF values of
// the fields a camera override changed.
const exifOriginalsField = "exifOriginals"

// maxOverrideRules is how many rules one camera override can have.
const maxOverrideRules = 200

// CameraOverride is a camera override file: what to write instead of the
// EXIF values of photos taken with one camera, such as "Fujifilm X-T5" for
// the camera "X-T5", or a lens's name for the lens "21.0 mm".
type CameraOverride struct {
	ID string `json:"id"`
	// Camera is the camera as its photos' EXIF names it, such as "X-T5".
	Camera string `json:"camera"`
	// Rules are applied in order, so a later rule's value for a field wins.
	Rules []OverrideRule `json:"rules"`
}

// OverrideRule sets fields of the photos taken with a camera, all of them or
// only those whose EXIF has one value, such as one lens.
type OverrideRule struct {
	// When limits the rule to photos whose EXIF has Field set to Value; nil
	// for every photo taken with the camera.
	When *OverrideCondition `json:"when"`
	// Set are the fields the rule writes, by field, such as
	// {"lens": "7Artisans 12mm f/2.8", "aperture": 2.8}.
	Set map[string]json.RawMessage `json:"set"`
}

// OverrideCondition is one field's EXIF value, such as the lens "21.0 mm".
type OverrideCondition struct {
	Field string          `json:"field"`
	Value json.RawMessage `json:"value"`
}

// SaveCameraOverride saves override as <folder>/cameras/<id>.json, new or
// replacing the one there, in the pending changes. It fails when another
// override is for the same camera.
func (c *Client) SaveCameraOverride(ctx context.Context, gh settings.GitHub, override CameraOverride) (EntryResult, error) {
	override, perr := validCameraOverride(override)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, Cameras, override.ID, override, func(others []Entry) *PublishError {
		for _, o := range parseOverrides(others) {
			if o.Camera == override.Camera {
				return publishErr(http.StatusConflict, "There's already an override for the camera %q (%s). Edit that one.", o.Camera, o.ID)
			}
		}
		return nil
	})
}

// DeleteCameraOverride removes the camera override file named id in the
// pending changes. It fails when there's no such override.
func (c *Client) DeleteCameraOverride(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, Cameras, id, func([]Entry) *PublishError { return nil })
}

// parseOverrides is the camera overrides in entries that can be read.
func parseOverrides(entries []Entry) []CameraOverride {
	var out []CameraOverride
	for _, e := range entries {
		var o CameraOverride
		if json.Unmarshal(e.Data, &o) == nil && o.Camera != "" {
			out = append(out, o)
		}
	}
	return out
}

// ApplyCameraOverrides is s with the camera overrides for its camera made
// over its EXIF values, as a new photo's JSON gets them, and the values they
// replaced kept in ExifOriginals.
func ApplyCameraOverrides(overrides []CameraOverride, s exif.Sanitized) exif.Sanitized {
	raw, err := json.Marshal(s)
	if err != nil {
		return s
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return s
	}
	maps.Copy(fields, overriddenFields(overrides, nil, fields))
	raw, _ = json.Marshal(fields)
	var out exif.Sanitized
	if json.Unmarshal(raw, &out) != nil {
		return s
	}
	return out
}

// overriddenFields is every OverrideFields value of a photo with the
// fields, top-level JSON values as its file has them, once the overrides are
// made over its EXIF values, then its custom lens's (see lensFields), and
// its exifOriginalsField. The EXIF values
// are the fields' own, or the ones exifOriginalsField kept when an override
// changed them, so applying the overrides again starts from EXIF, and a field
// no override sets any more goes back to its EXIF value.
func overriddenFields(overrides []CameraOverride, lenses []CustomLens, fields map[string]json.RawMessage) map[string]json.RawMessage {
	original := exifValues(fields)
	out := maps.Clone(original)
	if o := overrideFor(overrides, original["camera"]); o != nil {
		for _, rule := range o.Rules {
			if rule.When == nil || sameJSON(original[rule.When.Field], rule.When.Value) {
				maps.Copy(out, rule.Set)
			}
		}
	}
	maps.Copy(out, lensFields(lenses, fields[customLensField]))
	kept := map[string]json.RawMessage{}
	for _, f := range OverrideFields {
		if !sameJSON(out[f], original[f]) {
			kept[f] = original[f]
		}
	}
	raw, _ := json.Marshal(kept)
	out[exifOriginalsField] = raw
	return out
}

// exifValues is each OverrideFields field's EXIF value in fields: the one
// exifOriginalsField kept, or else the field's own, null when it's missing.
func exifValues(fields map[string]json.RawMessage) map[string]json.RawMessage {
	var kept map[string]json.RawMessage
	_ = json.Unmarshal(fields[exifOriginalsField], &kept)
	values := make(map[string]json.RawMessage, len(OverrideFields))
	for _, f := range OverrideFields {
		v, ok := kept[f]
		if !ok {
			v = fields[f]
		}
		values[f] = compactOrNull(v)
	}
	return values
}

// overrideFor is the override in overrides for camera, a JSON value, or nil
// when there's none.
func overrideFor(overrides []CameraOverride, camera json.RawMessage) *CameraOverride {
	var name string
	if json.Unmarshal(camera, &name) != nil || name == "" {
		return nil
	}
	for i := range overrides {
		if overrides[i].Camera == name {
			return &overrides[i]
		}
	}
	return nil
}

// compactOrNull is v compacted, or null when it's missing or not JSON.
func compactOrNull(v json.RawMessage) json.RawMessage {
	var out bytes.Buffer
	if len(v) == 0 || json.Compact(&out, v) != nil {
		return json.RawMessage("null")
	}
	return out.Bytes()
}

// sameJSON reports whether a and b are the same JSON value, as written
// once compacted, a missing one being null.
func sameJSON(a, b json.RawMessage) bool {
	return bytes.Equal(compactOrNull(a), compactOrNull(b))
}

// validCameraOverride checks o and returns it trimmed, with its values
// compacted, as it will be saved.
func validCameraOverride(o CameraOverride) (CameraOverride, *PublishError) {
	out := CameraOverride{ID: strings.TrimSpace(o.ID), Camera: strings.TrimSpace(o.Camera), Rules: []OverrideRule{}}
	if perr := validEntryID(Cameras.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Camera == "" {
		return out, publishErr(http.StatusBadRequest, "Say which camera the override is for, as its EXIF names it.")
	}
	if utf8.RuneCountInString(out.Camera) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Keep the camera to %d characters.", maxEntryTextLength)
	}
	if len(o.Rules) > maxOverrideRules {
		return out, publishErr(http.StatusBadRequest, "Keep an override to %d rules.", maxOverrideRules)
	}
	for i, rule := range o.Rules {
		r, perr := validOverrideRule(rule)
		if perr != nil {
			return out, publishErr(perr.Status, "Rule %d: %s", i+1, perr.Message)
		}
		out.Rules = append(out.Rules, r)
	}
	return out, nil
}

// validOverrideRule checks r and returns it with its values compacted.
func validOverrideRule(r OverrideRule) (OverrideRule, *PublishError) {
	out := OverrideRule{Set: map[string]json.RawMessage{}}
	if len(r.Set) == 0 {
		return out, publishErr(http.StatusBadRequest, "Give the rule at least one field to set.")
	}
	for field, value := range r.Set {
		v, perr := overrideValue(field, value)
		if perr != nil {
			return out, perr
		}
		out.Set[field] = v
	}
	if r.When == nil {
		return out, nil
	}
	v, perr := overrideValue(r.When.Field, r.When.Value)
	out.When = &OverrideCondition{Field: r.When.Field, Value: v}
	return out, perr
}

// overrideValue is value compacted, or an error unless field is one of
// OverrideFields and value is of the type the photo files give it.
func overrideValue(field string, value json.RawMessage) (json.RawMessage, *PublishError) {
	if !slices.Contains(OverrideFields, field) {
		return nil, publishErr(http.StatusBadRequest, "An override sets one of %s.", strings.Join(OverrideFields, ", "))
	}
	v := compactOrNull(value)
	var s exif.Sanitized
	if json.Unmarshal(fmt.Appendf(nil, `{%q:%s}`, field, v), &s) != nil {
		return nil, publishErr(http.StatusBadRequest, "%s %s isn't the kind of value the photo files have for it.", field, v)
	}
	return v, nil
}
