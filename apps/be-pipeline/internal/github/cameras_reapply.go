package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// FieldChange is one field a camera override changes in a photo file.
type FieldChange struct {
	Field string `json:"field"`
	// From is the field's value now, null when the file doesn't have it.
	From json.RawMessage `json:"from"`
	To   json.RawMessage `json:"to"`
}

// OverrideFile is a photo file the camera overrides change.
type OverrideFile struct {
	Path    string `json:"path"`
	FileURL string `json:"fileUrl"`
	// Camera is the photo's camera as its EXIF names it.
	Camera  string        `json:"camera"`
	Changes []FieldChange `json:"changes"`
}

// OverridesPreview is what applying the camera overrides again would do to
// the photo files on Branch.
type OverridesPreview struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// Overrides is how many camera overrides there are.
	Overrides  int                 `json:"overrides"`
	Files      []OverrideFile      `json:"files"`
	Unreadable []BaseURLUnreadable `json:"unreadable"`
}

// OverridesResult says where the photo files the camera overrides changed
// were saved: in the pending changes, for the next Commit.
type OverridesResult struct {
	pendingSave
	Files  int `json:"files"`
	Fields int `json:"fields"`
}

// PreviewReapplyOverrides reads every photo JSON file, as PreviewBaseURL
// does, and lists the fields the camera overrides and its custom lens would
// change in each, starting from its EXIF values: its own, or the ones its exifOriginals
// kept. A field no override sets any more goes back to its EXIF value. It
// only reads.
func (c *Client) PreviewReapplyOverrides(ctx context.Context, gh settings.GitHub) (OverridesPreview, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return OverridesPreview{}, perr
	}
	overrides, lenses := parseOverrides(scan.w.entries(Cameras)), parseLenses(scan.w.entries(Lenses))
	preview := OverridesPreview{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch, Overrides: len(overrides),
		Files: []OverrideFile{}, Unreadable: []BaseURLUnreadable{},
	}
	if scan.pr != nil {
		preview.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	for _, f := range scan.files {
		if f.err != "" {
			preview.Unreadable = append(preview.Unreadable, BaseURLUnreadable{Path: f.path, Error: f.err})
			continue
		}
		preview.PhotoFiles++
		if file, ok := overrideFile(overrides, lenses, f); ok {
			preview.Files = append(preview.Files, file)
		}
	}
	return preview, nil
}

// ReapplyOverrides makes the changes PreviewReapplyOverrides lists, in the
// pending changes, leaving the rest of each file byte for byte. Nothing is
// saved when any photo file can't be read.
func (c *Client) ReapplyOverrides(ctx context.Context, gh settings.GitHub) (OverridesResult, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return OverridesResult{}, perr
	}
	overrides, lenses := parseOverrides(scan.w.entries(Cameras)), parseLenses(scan.w.entries(Lenses))
	var entries []map[string]string
	result := OverridesResult{}
	for _, f := range scan.files {
		if f.err != "" {
			return OverridesResult{}, publishErr(http.StatusConflict,
				"%s couldn't be read (%s), so nothing was changed.", f.path, f.err)
		}
		file, ok := overrideFile(overrides, lenses, f)
		if !ok {
			continue
		}
		content, err := applyEdit(f.content, fieldEdit(file))
		if err != nil {
			return OverridesResult{}, publishErr(http.StatusConflict, "%s couldn't be changed: %v.", f.path, err)
		}
		entries = append(entries, map[string]string{"path": f.path, "content": string(content)})
		result.Files++
		result.Fields += len(file.Changes)
	}
	if len(entries) == 0 {
		return OverridesResult{}, publishErr(http.StatusConflict, "Every photo file already has its camera overrides, so there's nothing to change.")
	}
	if result.pendingSave, perr = c.saveScan(scan, entries); perr != nil {
		return OverridesResult{}, perr
	}
	return result, nil
}

// overrideFile is the fields the overrides change in f, and whether they
// change any. A field the file doesn't have is only added when it gets a
// value, so files from before exifOriginals aren't changed just to add it.
func overrideFile(overrides []CameraOverride, lenses []CustomLens, f photoFile) (OverrideFile, bool) {
	var fields map[string]json.RawMessage
	if json.Unmarshal(f.content, &fields) != nil {
		return OverrideFile{}, false
	}
	next := overriddenFields(overrides, lenses, fields)
	file := OverrideFile{Path: f.path, FileURL: f.fileURL}
	_ = json.Unmarshal(exifValues(fields)["camera"], &file.Camera)
	for _, field := range append(slices.Clone(OverrideFields), exifOriginalsField) {
		from, had := fields[field]
		to := next[field]
		if sameJSON(from, to) || (!had && isEmptyJSON(to)) {
			continue
		}
		file.Changes = append(file.Changes, FieldChange{Field: field, From: compactOrNull(from), To: to})
	}
	return file, len(file.Changes) > 0
}

// isEmptyJSON reports null or an empty object.
func isEmptyJSON(v json.RawMessage) bool {
	c := string(compactOrNull(v))
	return c == "null" || c == "{}"
}

// fieldEdit is file's changes as a FieldEdit.
func fieldEdit(file OverrideFile) FieldEdit {
	edit := FieldEdit{Path: file.Path, Fields: map[string]json.RawMessage{}}
	for _, ch := range file.Changes {
		edit.Fields[ch.Field] = ch.To
	}
	return edit
}
