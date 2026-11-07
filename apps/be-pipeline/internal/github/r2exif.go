package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// R2ExifEditsField is where a photo file keeps the edits made to its
// original's EXIF in R2 (see R2ExifEdit), oldest first. Like colors it's left
// out of newPhotoJSON's defaults, so only edited photos have it, and the
// portfolio's build leaves it out.
const R2ExifEditsField = "r2ExifEdits"

// R2ExifEdit is one edit of a photo's original's EXIF in R2: when it was made
// and each field it wrote.
type R2ExifEdit struct {
	// Date is when the original was overwritten, in RFC 3339.
	Date   string            `json:"date"`
	Fields []R2ExifFieldEdit `json:"fields"`
}

// R2ExifFieldEdit is one field an edit wrote into the original's EXIF, and
// whether the same change has been made in Lightroom, which is ticked by hand.
type R2ExifFieldEdit struct {
	// Field is the photo JSON field, one of exif.EditableFields.
	Field string `json:"field"`
	// From is the value the EXIF had before, as Sanitize reads it; nil when it
	// had none.
	From *string `json:"from"`
	// To is the value written.
	To string `json:"to"`
	// Lightroom is ticked once the change has been made in Lightroom's
	// catalog too, so the next export from Lightroom keeps it.
	Lightroom bool `json:"lightroom"`
}

// R2ExifMismatch is a field whose value in the photo JSON isn't the one the
// original's EXIF in R2 has.
type R2ExifMismatch struct {
	Field string `json:"field"`
	// Photo is the value the pipeline shows, the custom one when there is
	// one, written as exif.EditTags takes it.
	Photo string `json:"photo"`
	// R2 is the EXIF's value; nil when the EXIF doesn't have the field.
	R2 *string `json:"r2"`
	// Source is "custom" when Photo is a custom field written on the Photo
	// page (such as customCreateDate from Times across timezones),
	// "override" when a camera override or custom lens set it, or "".
	Source string `json:"source"`
}

// R2ExifPhoto is a photo whose original's EXIF doesn't match its photo file,
// or that has edits to tick off in Lightroom.
type R2ExifPhoto struct {
	Path    string `json:"path"`
	FileURL string `json:"fileUrl"`
	// Key is the original's object key in R2.
	Key   string `json:"key"`
	Title string `json:"title"`
	// Thumbnail is the Square Thumbnail's URL; "" when it has none.
	Thumbnail  string           `json:"thumbnail"`
	Mismatches []R2ExifMismatch `json:"mismatches"`
	Edits      []R2ExifEdit     `json:"edits"`
	// Error says why the original's EXIF couldn't be read, so its
	// mismatches aren't known.
	Error string `json:"error,omitempty"`
}

// R2ExifPreview is the photos whose originals in R2 don't match their photo
// files, as the next Commit will have them, and the ones edited before.
type R2ExifPreview struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// Checked is how many originals were read; photos without images.key
	// aren't.
	Checked    int                 `json:"checked"`
	Photos     []R2ExifPhoto       `json:"photos"`
	Unreadable []BaseURLUnreadable `json:"unreadable"`
}

// R2ExifResult says where a photo file's edits were saved: in the pending
// changes, for the next Commit.
type R2ExifResult struct {
	pendingSave
	// Edits are the photo file's edits as saved.
	Edits []R2ExifEdit `json:"edits"`
}

// customFields are the custom field the Photo page writes over each EXIF
// field, which the pipeline shows instead.
var customFields = map[string]string{
	"createDate": "customCreateDate", "gpsPosition": "customGpsPosition",
	"city": "customCity", "state": "customState", "country": "customCountry",
}

// PreviewR2Exif reads every photo JSON file, as PreviewBaseURL does, and the
// EXIF of each one's original in R2 at images.key, and lists the photos where
// a field the pipeline shows (custom fields over EXIF ones) isn't what the
// EXIF has, along with every photo edited before. It only reads.
func (c *Client) PreviewR2Exif(ctx context.Context, gh settings.GitHub, read ExifReader) (R2ExifPreview, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return R2ExifPreview{}, perr
	}
	preview := R2ExifPreview{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch, PullRequest: scanPullRequest(scan),
		Photos: []R2ExifPhoto{}, Unreadable: []BaseURLUnreadable{},
	}
	photos := make([]*R2ExifPhoto, len(scan.files))
	var reads []func()
	for i, f := range scan.files {
		if f.err != "" {
			preview.Unreadable = append(preview.Unreadable, BaseURLUnreadable{Path: f.path, Error: f.err})
			continue
		}
		preview.PhotoFiles++
		p := newR2ExifPhoto(f)
		if p.Key == "" {
			continue
		}
		photos[i] = p
		preview.Checked++
		reads = append(reads, func() { p.check(ctx, read, f.content) })
	}
	readOriginals(ctx, reads)
	for _, p := range photos {
		if p != nil && (len(p.Mismatches) > 0 || len(p.Edits) > 0 || p.Error != "") {
			preview.Photos = append(preview.Photos, *p)
		}
	}
	return preview, nil
}

// newR2ExifPhoto is f's photo, with its edits but not yet its mismatches.
func newR2ExifPhoto(f photoFile) *R2ExifPhoto {
	var photo struct {
		Title  *string `json:"title"`
		Images struct {
			Key       *string `json:"key"`
			Thumbnail *string `json:"thumbnail"`
		} `json:"images"`
	}
	_ = json.Unmarshal(f.content, &photo)
	return &R2ExifPhoto{
		Path: f.path, FileURL: f.fileURL, Key: imageKey(f.content), Title: deref(photo.Title),
		Thumbnail: deref(photo.Images.Thumbnail), Mismatches: []R2ExifMismatch{}, Edits: r2ExifEdits(f.content),
	}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// check reads p's original's EXIF and finds where content doesn't match it.
func (p *R2ExifPhoto) check(ctx context.Context, read ExifReader, content []byte) {
	s, msg := read(ctx, p.Key)
	if msg != "" {
		p.Error = msg
		return
	}
	p.Mismatches = R2ExifMismatches(content, s)
}

// R2ExifMismatches is each of exif.EditableFields whose value in content, a
// photo file, isn't the one s, its original's EXIF, has. A field the photo
// file has no value for isn't a mismatch, since there's nothing to write.
func R2ExifMismatches(content []byte, s exif.Sanitized) []R2ExifMismatch {
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(content, &fields)
	out := []R2ExifMismatch{}
	for _, field := range exif.EditableFields {
		value, source, ok := shownValue(fields, field)
		have := exif.ReadValue(field, s)
		if ok && !exif.SameValue(field, value, have) {
			out = append(out, R2ExifMismatch{Field: field, Photo: value, R2: have, Source: source})
		}
	}
	return out
}

// shownValue is field's value as the pipeline shows it, the custom one over
// the EXIF one, with where it came from (see R2ExifMismatch.Source).
func shownValue(fields map[string]json.RawMessage, field string) (value, source string, ok bool) {
	if custom, has := customFields[field]; has {
		if v, ok := jsonText(fields[custom]); ok {
			return v, "custom", true
		}
	}
	value, ok = jsonText(fields[field])
	if ok && hasOriginal(fields, field) {
		source = "override"
	}
	return value, source, ok
}

// hasOriginal reports whether the photo file's exifOriginals keeps an EXIF
// value for field, so a camera override or custom lens changed it.
func hasOriginal(fields map[string]json.RawMessage, field string) bool {
	var originals map[string]json.RawMessage
	_ = json.Unmarshal(fields["exifOriginals"], &originals)
	_, ok := originals[field]
	return ok
}

// jsonText is a JSON string or number as text; false for null, "" or
// anything else.
func jsonText(raw json.RawMessage) (string, bool) {
	var s string
	if json.Unmarshal(raw, &s) == nil {
		s = strings.TrimSpace(s)
		return s, s != ""
	}
	var n float64
	if json.Unmarshal(raw, &n) == nil {
		return strconv.FormatFloat(n, 'f', -1, 64), true
	}
	return "", false
}

// r2ExifEdits is the edits saved in content, a photo file; empty when it has
// none or they can't be read.
func r2ExifEdits(content []byte) []R2ExifEdit {
	var photo struct {
		Edits []R2ExifEdit `json:"r2ExifEdits"`
	}
	if json.Unmarshal(content, &photo) != nil || photo.Edits == nil {
		return []R2ExifEdit{}
	}
	return photo.Edits
}

// R2ExifKey is the original's object key the photo file at path points at,
// checked before its EXIF is edited. It fails when the file can't be read or
// has no images.key.
func (c *Client) R2ExifKey(ctx context.Context, gh settings.GitHub, path string) (string, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return "", perr
	}
	content, perr := scannedPhoto(scan, path)
	if perr != nil {
		return "", perr
	}
	key := imageKey(content)
	if key == "" {
		return "", publishErr(http.StatusConflict, "%s has no images.key, so its original can't be found in R2.", path)
	}
	return key, nil
}

// scannedPhoto is the photo file at path, as the next Commit will have it.
func scannedPhoto(scan baseURLScan, path string) ([]byte, *PublishError) {
	photos, perr := picked(scan, []string{path})
	if perr != nil {
		return nil, perr
	}
	return photos[0].file.content, nil
}

// RecordR2ExifEdit adds fields, just written into the EXIF of the original at
// key, to the edits of the photo file at path, dated now, in the pending
// changes. It fails, saving nothing, when the file no longer points at key.
func (c *Client) RecordR2ExifEdit(ctx context.Context, gh settings.GitHub, path, key string, fields []R2ExifFieldEdit) (R2ExifResult, error) {
	return c.changeR2ExifEdits(ctx, gh, path, func(content []byte, edits []R2ExifEdit) ([]R2ExifEdit, *PublishError) {
		if imageKey(content) != key {
			return nil, publishErr(http.StatusConflict, "%s points at another original now, so the edit wasn't noted.", path)
		}
		return append(edits, R2ExifEdit{Date: time.Now().UTC().Format(time.RFC3339), Fields: fields}), nil
	})
}

// SetR2ExifLightroom ticks (or unticks, with done false) field of the photo
// file at path's edit number edit (counting from 0, oldest first) as made in
// Lightroom too, in the pending changes.
func (c *Client) SetR2ExifLightroom(ctx context.Context, gh settings.GitHub, path string, edit int, field string, done bool) (R2ExifResult, error) {
	return c.changeR2ExifEdits(ctx, gh, path, func(_ []byte, edits []R2ExifEdit) ([]R2ExifEdit, *PublishError) {
		if edit < 0 || edit >= len(edits) {
			return nil, publishErr(http.StatusNotFound, "%s has no such EXIF edit. Check the photos again.", path)
		}
		i := slices.IndexFunc(edits[edit].Fields, func(f R2ExifFieldEdit) bool { return f.Field == field })
		if i < 0 {
			return nil, publishErr(http.StatusNotFound, "That EXIF edit of %s didn't change %s.", path, field)
		}
		edits[edit].Fields[i].Lightroom = done
		return edits, nil
	})
}

// changeR2ExifEdits saves the photo file at path with its edits as change
// makes them, in the pending changes.
func (c *Client) changeR2ExifEdits(
	ctx context.Context, gh settings.GitHub, path string,
	change func([]byte, []R2ExifEdit) ([]R2ExifEdit, *PublishError),
) (R2ExifResult, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return R2ExifResult{}, perr
	}
	before, perr := scannedPhoto(scan, path)
	if perr != nil {
		return R2ExifResult{}, perr
	}
	edits, perr := change(before, r2ExifEdits(before))
	if perr != nil {
		return R2ExifResult{}, perr
	}
	value, err := json.Marshal(edits)
	if err != nil {
		return R2ExifResult{}, err
	}
	after, err := setField(before, R2ExifEditsField, value)
	if err != nil {
		return R2ExifResult{}, publishErr(http.StatusConflict, "%s couldn't be changed: %v.", path, err)
	}
	saved, perr := c.saveFiles(scan.w, []ScanChange{{Path: path, Before: before, After: after}})
	if perr != nil {
		return R2ExifResult{}, perr
	}
	return R2ExifResult{pendingSave: saved, Edits: edits}, nil
}
