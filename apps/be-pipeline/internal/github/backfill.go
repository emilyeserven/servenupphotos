package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// exifConcurrency is how many originals Backfill reads EXIF from at once.
const exifConcurrency = 4

// ExifReader returns the sanitized EXIF of the original photo at key in R2,
// or a message fit to show saying why it couldn't.
type ExifReader func(ctx context.Context, key string) (exif.Sanitized, string)

// AddedField is a field Backfill adds to a photo file.
type AddedField struct {
	// Field is where the field goes, such as "aperture" or "images.thumbnail".
	Field string          `json:"field"`
	Value json.RawMessage `json:"value"`
	// FromExif is true when Value was read from the photo's original in R2,
	// rather than being the field's default.
	FromExif bool `json:"fromExif"`
}

// BackfillFile is a photo file missing fields.
type BackfillFile struct {
	Path    string       `json:"path"`
	FileURL string       `json:"fileUrl"`
	Added   []AddedField `json:"added"`
	// ExifError says why the photo's EXIF couldn't be read, when it was
	// tried, so its EXIF fields get their defaults instead.
	ExifError string `json:"exifError,omitempty"`
}

// MissingField counts the photo files missing one field.
type MissingField struct {
	Field string `json:"field"`
	Files int    `json:"files"`
	// FromExif is how many of them get it from the photo's EXIF.
	FromExif int `json:"fromExif"`
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

// BackfillResult says where the added fields were committed.
type BackfillResult struct {
	scanCommit
	Files  int `json:"files"`
	Fields int `json:"fields"`
}

// PreviewBackfill reads every photo JSON file, as PreviewBaseURL does, and
// lists the fields each is missing compared with a new photo file, with the
// values Backfill would add. With readExif non-nil, a missing EXIF field
// (exif.SanitizeFields) is read from the photo's original in R2, when the
// file has its key; otherwise it gets the field's default. It only reads.
func (c *Client) PreviewBackfill(ctx context.Context, gh settings.GitHub, readExif ExifReader) (BackfillPreview, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BackfillPreview{}, perr
	}
	plans, perr := planBackfill(ctx, scan, readExif)
	if perr != nil {
		return BackfillPreview{}, perr
	}
	preview := BackfillPreview{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch, ReadExif: readExif != nil,
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
		file := BackfillFile{Path: f.path, FileURL: f.fileURL, ExifError: plan.exifErr}
		for _, g := range plan.gaps {
			file.Added = append(file.Added, AddedField{Field: g.field, Value: g.value, FromExif: g.fromExif})
			n := counts[g.field]
			if n == nil {
				n = &MissingField{Field: g.field}
				counts[g.field] = n
			}
			n.Files++
			if g.fromExif {
				n.FromExif++
			}
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
// them, as one commit as ReplaceBaseURL makes. Fields a file has, even null
// ones, are never changed, and the rest of each file is kept byte for byte.
// Nothing is committed when any photo file can't be read.
func (c *Client) Backfill(ctx context.Context, gh settings.GitHub, readExif ExifReader) (BackfillResult, error) {
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
	plans, perr := planBackfill(ctx, scan, readExif)
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

	message := fmt.Sprintf("Add missing fields to %d photo %s", result.Files, plural(result.Files, "file"))
	if result.scanCommit, perr = c.commitScan(ctx, scan, entries, message); perr != nil {
		return BackfillResult{}, perr
	}
	return result, nil
}

func plural(n int, word string) string {
	if n == 1 {
		return word
	}
	return word + "s"
}

// backfillPlan is what one photo file is missing.
type backfillPlan struct {
	gaps    []gap
	exifErr string
}

// planBackfill finds the gaps in every readable file of scan, filling EXIF
// fields with readExif when it is non-nil. Files are read a few at a time.
func planBackfill(ctx context.Context, scan baseURLScan, readExif ExifReader) ([]backfillPlan, *PublishError) {
	tmpl := photoTemplate()
	plans := make([]backfillPlan, len(scan.files))
	var wg sync.WaitGroup
	sem := make(chan struct{}, exifConcurrency)
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
		key := imageKey(f.content)
		if readExif == nil || key == "" || !slices.ContainsFunc(gaps, isExifGap) {
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			plans[i].exifErr = fillFromExif(ctx, readExif, key, plans[i].gaps)
		}()
	}
	wg.Wait()
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
