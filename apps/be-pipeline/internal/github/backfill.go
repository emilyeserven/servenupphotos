package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// exifConcurrency is how many originals Backfill reads EXIF from at once.
const exifConcurrency = 4

// ExifReader returns the sanitized EXIF of the original photo at key in R2,
// or a message fit to show saying why it couldn't.
type ExifReader func(ctx context.Context, key string) (exif.Sanitized, string)

// CropReader returns the crop saved with the Square Thumbnail of the
// original photo at key in R2, nil when it has none, or a message fit to
// show saying why it couldn't.
type CropReader func(ctx context.Context, key string) (*versions.Crop, string)

// Readers read what Backfill fills a missing field with from R2. Either may
// be nil, and the fields it would fill get their defaults instead.
type Readers struct {
	Exif ExifReader
	Crop CropReader
}

// thumbnailCropField is where a photo file saves its Square Thumbnail's
// crop, which Backfill reads from the Thumbnail's ?crop= mark or from R2.
const thumbnailCropField = "images.thumbnailcrop"

// AddedField is a field Backfill adds to a photo file.
type AddedField struct {
	// Field is where the field goes, such as "aperture" or "images.thumbnail".
	Field string          `json:"field"`
	Value json.RawMessage `json:"value"`
	// FromExif is true when Value was read from the photo's original in R2,
	// rather than being the field's default.
	FromExif bool `json:"fromExif"`
	// FromThumbnail is true when Value was read from the photo's Square
	// Thumbnail: the crop marked on its URL, or saved with it in R2.
	FromThumbnail bool `json:"fromThumbnail"`
	// Numbered is true when Value is the photo's new ID, counted in the
	// order the photo files were created.
	Numbered bool `json:"numbered"`
	// FromHistory is true when Value is the photo's addedDate, read from
	// when its file was first committed.
	FromHistory bool `json:"fromHistory"`
}

// BackfillFile is a photo file missing fields.
type BackfillFile struct {
	Path    string       `json:"path"`
	FileURL string       `json:"fileUrl"`
	Added   []AddedField `json:"added"`
	// ExifError says why the photo's EXIF couldn't be read, when it was
	// tried, so its EXIF fields get their defaults instead.
	ExifError string `json:"exifError,omitempty"`
	// CropError says why the Square Thumbnail's crop couldn't be read from
	// R2, when it was tried, so the crop gets its default instead.
	CropError string `json:"cropError,omitempty"`
}

// MissingField counts the photo files missing one field.
type MissingField struct {
	Field string `json:"field"`
	Files int    `json:"files"`
	// FromExif is how many of them get it from the photo's EXIF.
	FromExif int `json:"fromExif"`
	// FromThumbnail is how many of them get it from the Square Thumbnail.
	FromThumbnail int `json:"fromThumbnail"`
	// Numbered is how many of them get a new photo ID.
	Numbered int `json:"numbered"`
	// FromHistory is how many of them get the date their file was first
	// committed.
	FromHistory int `json:"fromHistory"`
}

// count adds g, a missing field of one more file, to n.
func (n *MissingField) count(g gap) {
	n.Files++
	n.FromExif += boolInt(g.fromExif)
	n.FromThumbnail += boolInt(g.fromThumbnail)
	n.Numbered += boolInt(g.numbered)
	n.FromHistory += boolInt(g.fromHistory)
}

// boolInt is 1 for true and 0 for false.
func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// BackfillPreview is what adding the missing fields would do to the photo
// files on Branch.
type BackfillPreview struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// Fields are the missing fields in the order new photo files list them.
	Fields     []MissingField      `json:"fields"`
	Files      []BackfillFile      `json:"files"`
	Unreadable []BaseURLUnreadable `json:"unreadable"`
	// ReadExif is true when EXIF fields were read from the originals in R2.
	ReadExif bool `json:"readExif"`
}

// BackfillResult says where the added fields were saved: in the pending
// changes, for the next Commit.
type BackfillResult struct {
	pendingSave
	Files  int `json:"files"`
	Fields int `json:"fields"`
}

// PreviewBackfill reads every photo JSON file, as PreviewBaseURL does, and
// lists the fields each is missing compared with a new photo file, with the
// values Backfill would add. With read.Exif non-nil, a missing EXIF field
// (exif.SanitizeFields) is read from the photo's original in R2, when the
// file has its key; otherwise it gets the field's default. A missing
// images.thumbnailcrop is read from the ?crop= mark on images.thumbnail, or
// with read.Crop non-nil from the crop saved with the thumbnail in R2. It
// only reads.
func (c *Client) PreviewBackfill(ctx context.Context, gh settings.GitHub, read Readers) (BackfillPreview, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BackfillPreview{}, perr
	}
	plans, perr := c.planBackfill(ctx, scan, read)
	if perr != nil {
		return BackfillPreview{}, perr
	}
	preview := BackfillPreview{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch, ReadExif: read.Exif != nil,
		Fields: []MissingField{}, Files: []BackfillFile{}, Unreadable: []BaseURLUnreadable{},
	}
	if scan.pr != nil {
		preview.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	counts := map[string]*MissingField{}
	for i, f := range scan.files {
		if f.err != "" {
			preview.Unreadable = append(preview.Unreadable, BaseURLUnreadable{Path: f.path, Error: f.err})
			continue
		}
		preview.PhotoFiles++
		plan := plans[i]
		if len(plan.gaps) == 0 {
			continue
		}
		file := BackfillFile{Path: f.path, FileURL: f.fileURL, ExifError: plan.exifErr, CropError: plan.cropErr}
		for _, g := range plan.gaps {
			file.Added = append(file.Added, AddedField{
				Field: g.field, Value: g.value, FromExif: g.fromExif, FromThumbnail: g.fromThumbnail,
				Numbered: g.numbered, FromHistory: g.fromHistory,
			})
			n := counts[g.field]
			if n == nil {
				n = &MissingField{Field: g.field}
				counts[g.field] = n
			}
			n.count(g)
		}
		preview.Files = append(preview.Files, file)
	}
	for _, field := range templateFieldNames() {
		if n := counts[field]; n != nil {
			preview.Fields = append(preview.Fields, *n)
		}
	}
	return preview, nil
}

// Backfill adds the fields PreviewBackfill lists to every photo file missing
// them, in the pending changes as ReplaceBaseURL saves them. Fields a file has, even null
// ones, are never changed, and the rest of each file is kept byte for byte.
// Nothing is saved when any photo file can't be read.
func (c *Client) Backfill(ctx context.Context, gh settings.GitHub, read Readers) (BackfillResult, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BackfillResult{}, perr
	}
	for _, f := range scan.files {
		if f.err != "" {
			return BackfillResult{}, publishErr(http.StatusConflict,
				"%s couldn't be read (%s), so nothing was changed.", f.path, f.err)
		}
	}
	plans, perr := c.planBackfill(ctx, scan, read)
	if perr != nil {
		return BackfillResult{}, perr
	}

	var entries []map[string]string
	result := BackfillResult{}
	for i, f := range scan.files {
		if len(plans[i].gaps) == 0 {
			continue
		}
		entries = append(entries, map[string]string{
			"path": f.path, "mode": "100644", "type": "blob", "content": string(fillGaps(f.content, plans[i].gaps)),
		})
		result.Files++
		result.Fields += len(plans[i].gaps)
	}
	if len(entries) == 0 {
		return BackfillResult{}, publishErr(http.StatusConflict, "Every photo file has every field, so there's nothing to add.")
	}

	if result.pendingSave, perr = c.saveScan(scan, entries); perr != nil {
		return BackfillResult{}, perr
	}
	return result, nil
}

// backfillPlan is what one photo file is missing.
type backfillPlan struct {
	gaps    []gap
	exifErr string
	cropErr string
}

// planBackfill finds the gaps in every readable file of scan, as findPlans
// does, numbers the photos missing an ID (numberPhotos) and dates the ones
// missing addedDate (datePhotos), asking GitHub once when their files were
// created.
func (c *Client) planBackfill(ctx context.Context, scan baseURLScan, read Readers) ([]backfillPlan, *PublishError) {
	plans, perr := findPlans(ctx, scan, read)
	if perr != nil {
		return nil, perr
	}
	created, perr := c.createdTimes(ctx, scan.w, historyPaths(scan, plans))
	if perr != nil {
		return nil, perr
	}
	numberPhotos(scan, plans, created)
	datePhotos(scan, plans, created)
	return plans, nil
}

// historyPaths are the scanned files missing an ID or addedDate, which
// planBackfill needs the creation time of.
func historyPaths(scan baseURLScan, plans []backfillPlan) []string {
	var paths []string
	for i, f := range scan.files {
		if fieldGap(plans[i].gaps, idField) != nil || fieldGap(plans[i].gaps, addedField) != nil {
			paths = append(paths, f.path)
		}
	}
	return paths
}

// findPlans finds the gaps in every readable file of scan, filling EXIF
// fields with read.Exif and the thumbnail's crop from its URL or read.Crop,
// when they are non-nil. Files are read from R2 a few at a time.
func findPlans(ctx context.Context, scan baseURLScan, read Readers) ([]backfillPlan, *PublishError) {
	tmpl := photoTemplate()
	plans := make([]backfillPlan, len(scan.files))
	var reads []func()
	var bad error
	var mu sync.Mutex
	for i, f := range scan.files {
		if f.err != "" {
			continue
		}
		gaps, err := findGaps(f.content, tmpl)
		if err != nil {
			mu.Lock()
			bad = fmt.Errorf("%s: %w", f.path, err)
			mu.Unlock()
			continue
		}
		plans[i].gaps = gaps
		cropGap := slices.IndexFunc(gaps, func(g gap) bool { return g.field == thumbnailCropField })
		if cropGap >= 0 && fillCropFromURL(f.content, &gaps[cropGap]) {
			cropGap = -1
		}
		key := imageKey(f.content)
		needExif := read.Exif != nil && slices.ContainsFunc(gaps, isExifGap)
		needCrop := read.Crop != nil && cropGap >= 0
		if key == "" || (!needExif && !needCrop) {
			continue
		}
		reads = append(reads, func() {
			if needExif {
				plans[i].exifErr = fillFromExif(ctx, read.Exif, key, plans[i].gaps)
			}
			if needCrop {
				plans[i].cropErr = fillCropFromR2(ctx, read.Crop, key, &plans[i].gaps[cropGap])
			}
		})
	}
	readOriginals(ctx, reads)
	if bad != nil {
		return nil, publishErr(http.StatusBadGateway, "Couldn't read %v.", bad)
	}
	return plans, nil
}

// isExifGap reports a missing top-level field Sanitize fills from EXIF.
func isExifGap(g gap) bool {
	return !strings.Contains(g.field, ".") && slices.Contains(exif.SanitizeFields, g.field)
}

// fillFromExif sets the EXIF gaps to the photo's EXIF where it has a value,
// returning why it couldn't when it couldn't.
func fillFromExif(ctx context.Context, readExif ExifReader, key string, gaps []gap) string {
	s, msg := readExif(ctx, key)
	if msg != "" {
		return msg
	}
	raw, _ := json.Marshal(s)
	var values map[string]json.RawMessage
	_ = json.Unmarshal(raw, &values)
	for i, g := range gaps {
		if v, ok := values[g.field]; ok && isExifGap(g) && string(v) != "null" {
			gaps[i].value, gaps[i].fromExif = v, true
		}
	}
	return ""
}

// fillCropFromURL sets g, the thumbnail's crop, to the crop marked on the
// file's images.thumbnail URL as ?crop=x,y,size, reporting whether it had one.
func fillCropFromURL(content []byte, g *gap) bool {
	var photo struct {
		Images struct {
			Thumbnail *string `json:"thumbnail"`
		} `json:"images"`
	}
	if json.Unmarshal(content, &photo) != nil || photo.Images.Thumbnail == nil {
		return false
	}
	u, err := url.Parse(*photo.Images.Thumbnail)
	if err != nil {
		return false
	}
	crop, ok := versions.ParseCrop(u.Query().Get("crop"))
	if !ok {
		return false
	}
	setCropGap(g, crop)
	return true
}

// fillCropFromR2 sets g, the thumbnail's crop, to the crop saved with the
// Square Thumbnail in R2, when it has one, returning why it couldn't when it
// couldn't.
func fillCropFromR2(ctx context.Context, readCrop CropReader, key string, g *gap) string {
	crop, msg := readCrop(ctx, key)
	if msg != "" || crop == nil {
		return msg
	}
	setCropGap(g, *crop)
	return ""
}

func setCropGap(g *gap, crop versions.Crop) {
	g.value, _ = json.Marshal(savedCrop(crop))
	g.fromThumbnail = true
}

// savedCrop is crop as a photo file saves it, with the size of the
// Thumbnail cut from it.
func savedCrop(crop versions.Crop) exif.ThumbnailCrop {
	return exif.ThumbnailCrop{X: crop.X, Y: crop.Y, Size: crop.Size, OutputSize: versions.Thumbnail.MaxEdge}
}

// imageKey is a photo file's "images.key", its original's key in R2.
func imageKey(content []byte) string {
	var photo struct {
		Images struct {
			Key *string `json:"key"`
		} `json:"images"`
	}
	if json.Unmarshal(content, &photo) != nil || photo.Images.Key == nil {
		return ""
	}
	return strings.TrimSpace(*photo.Images.Key)
}

// templateField is a field of a new photo file, with its default value and,
// for an object, its own fields.
type templateField struct {
	key      string
	value    json.RawMessage
	children []templateField
}

// photoTemplate is newPhotoJSON's fields, in order, with their defaults.
func photoTemplate() []templateField {
	raw, err := json.Marshal(newPhotoJSON("", exif.Sanitized{}))
	if err != nil {
		panic(err)
	}
	fields, err := templateFields(raw)
	if err != nil {
		panic(err)
	}
	return fields
}

// templateFieldNames lists photoTemplate's fields and nested fields, in order.
func templateFieldNames() []string {
	var names []string
	var walk func(prefix string, fields []templateField)
	walk = func(prefix string, fields []templateField) {
		for _, f := range fields {
			names = append(names, prefix+f.key)
			walk(prefix+f.key+".", f.children)
		}
	}
	walk("", photoTemplate())
	return names
}

func templateFields(raw json.RawMessage) ([]templateField, error) {
	_, members, err := objectMembers(raw, 0)
	if err != nil {
		return nil, err
	}
	fields := make([]templateField, len(members))
	for i, m := range members {
		fields[i] = templateField{key: m.key, value: raw[m.valueStart:m.valueEnd]}
		if raw[m.valueStart] == '{' {
			if fields[i].children, err = templateFields(fields[i].value); err != nil {
				return nil, err
			}
		}
	}
	return fields, nil
}

// member is one key and value of a JSON object, by byte offsets.
type member struct {
	key                  string
	keyStart             int
	valueStart, valueEnd int
}

// objectMembers reads the JSON object starting at content[start], returning
// the offset of its opening brace and its members in order.
func objectMembers(content []byte, start int) (open int, members []member, err error) {
	dec := json.NewDecoder(bytes.NewReader(content[start:]))
	tok, err := dec.Token()
	if d, ok := tok.(json.Delim); err != nil || !ok || d != '{' {
		return 0, nil, errors.New("not a JSON object")
	}
	open = start + int(dec.InputOffset()) - 1
	prev := open + 1
	for dec.More() {
		tok, err := dec.Token()
		key, ok := tok.(string)
		if err != nil || !ok {
			return 0, nil, errors.New("not a JSON object")
		}
		keyEnd := start + int(dec.InputOffset())
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			return 0, nil, err
		}
		valueEnd := start + int(dec.InputOffset())
		members = append(members, member{
			key:        key,
			keyStart:   prev + bytes.IndexByte(content[prev:keyEnd], '"'),
			valueStart: valueEnd - len(raw),
			valueEnd:   valueEnd,
		})
		prev = valueEnd
	}
	if _, err := dec.Token(); err != nil {
		return 0, nil, err
	}
	return open, members, nil
}

// gap is a missing field and where it goes in the file.
type gap struct {
	field    string
	key      string
	value    json.RawMessage
	fromExif bool
	// fromThumbnail marks the thumbnail's crop read from its URL or R2.
	fromThumbnail bool
	// numbered marks the photo's new ID (numberPhotos).
	numbered bool
	// fromHistory marks the photo's addedDate read from when its file was
	// first committed (datePhotos).
	fromHistory bool
	// pos is the offset the field is inserted at: after the field before it,
	// or after the object's opening brace when lead is set.
	pos  int
	lead bool
	// empty marks a gap in an object that had no fields; first and last mark
	// the first gap there, which needs no comma before it, and the last, which
	// closes the object on a new line.
	empty, first, last bool
	indent             string
	parentIndent       string
	pretty             bool
}

// findGaps lists the fields of tmpl, and of its objects, that content's
// top-level object is missing, in tmpl's order.
func findGaps(content []byte, tmpl []templateField) ([]gap, error) {
	var gaps []gap
	err := objectGaps(content, 0, "", tmpl, &gaps)
	return gaps, err
}

func objectGaps(content []byte, start int, prefix string, tmpl []templateField, gaps *[]gap) error {
	open, members, err := objectMembers(content, start)
	if err != nil {
		return err
	}
	byKey := map[string]member{}
	for _, m := range members {
		byKey[m.key] = m
	}
	layout := objectLayout(content, open, members)
	anchor := -1
	firstGap := len(*gaps)
	for _, f := range tmpl {
		if m, ok := byKey[f.key]; ok {
			anchor = m.valueEnd
			if f.children != nil && content[m.valueStart] == '{' {
				if err := objectGaps(content, m.valueStart, prefix+f.key+".", f.children, gaps); err != nil {
					return err
				}
			}
			continue
		}
		g := layout
		g.field, g.key, g.value = prefix+f.key, f.key, f.value
		if anchor < 0 {
			g.pos, g.lead = open+1, true
		} else {
			g.pos = anchor
		}
		*gaps = append(*gaps, g)
	}
	if len(members) == 0 && len(*gaps) > firstGap {
		(*gaps)[firstGap].first = true
		(*gaps)[len(*gaps)-1].last = true
	}
	return nil
}

// objectLayout is how the object at open lays out its fields: on their own
// indented lines, or all on one line.
func objectLayout(content []byte, open int, members []member) gap {
	lineStart := bytes.LastIndexByte(content[:open], '\n') + 1
	i := lineStart
	for i < open && (content[i] == ' ' || content[i] == '\t') {
		i++
	}
	parentIndent := string(content[lineStart:i])
	if len(members) == 0 {
		pretty := bytes.IndexByte(content, '\n') >= 0
		return gap{empty: true, pretty: pretty, indent: parentIndent + "  ", parentIndent: parentIndent}
	}
	ws := content[open+1 : members[0].keyStart]
	nl := bytes.LastIndexByte(ws, '\n')
	if nl < 0 {
		return gap{}
	}
	return gap{pretty: true, indent: string(ws[nl+1:]), parentIndent: parentIndent}
}

// fillGaps returns content with every gap inserted.
func fillGaps(content []byte, gaps []gap) []byte {
	var out bytes.Buffer
	last := 0
	for _, g := range gaps {
		out.Write(content[last:g.pos])
		last = g.pos
		out.WriteString(gapText(g))
	}
	out.Write(content[last:])
	return out.Bytes()
}

// gapText is the text inserted for g, with the comma and line breaks it needs.
func gapText(g gap) string {
	newline, colon := "", ":"
	if g.pretty {
		newline, colon = "\n"+g.indent, ": "
	}
	value := g.value
	if g.pretty {
		var buf bytes.Buffer
		if json.Indent(&buf, g.value, g.indent, "  ") == nil {
			value = buf.Bytes()
		}
	}
	key, _ := json.Marshal(g.key)
	field := newline + string(key) + colon + string(value)
	if g.empty && !g.first {
		field = "," + field
	}
	switch {
	case g.empty && g.last && g.pretty:
		return field + "\n" + g.parentIndent
	case g.empty:
		return field
	case g.lead:
		return field + ","
	default:
		return "," + field
	}
}
