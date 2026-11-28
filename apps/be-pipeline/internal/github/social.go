package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// publishDateKey is the photo JSON field that holds the day a photo is
// posted to social media, as YYYY-MM-DD.
const publishDateKey = "socialMediaPublishDate"

// SocialPhoto is a photo JSON file as the Instagram calendar shows it.
type SocialPhoto struct {
	Path    string `json:"path"`
	FileURL string `json:"fileUrl"`
	// File, GPSPosition and CreateDate are the photo's PhotoIdentity, which
	// pages look for in AllPhotosFile on the base branch to tell photos in
	// flight from ones already in the portfolio.
	File        string  `json:"file"`
	GPSPosition *string `json:"gpsPosition"`
	CreateDate  *string `json:"createDate"`
	Title       *string `json:"title"`
	// Image is the photo's square thumbnail, or else its smallest resized
	// version; nil when it has none.
	Image                  *string `json:"image"`
	IsSocialMediaEligible  bool    `json:"isSocialMediaEligible"`
	SocialMediaPublishDate *string `json:"socialMediaPublishDate"`
	// Data is the whole file, so the app can show a date change in
	// ALLPHOTOS.json before it's committed.
	Data json.RawMessage `json:"data"`
}

// SocialCalendar is every photo file with its social media publish date.
type SocialCalendar struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch is where the photo files were read, as for BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	Photos      []SocialPhoto       `json:"photos"`
	Unreadable  []BaseURLUnreadable `json:"unreadable"`
}

// SocialDate sets the publish date of the photo file at Path. A nil Date
// clears it.
type SocialDate struct {
	Path string  `json:"path"`
	Date *string `json:"date"`
}

// SocialDatesResult says where publish date changes were saved: in the
// pending changes, for the next Commit.
type SocialDatesResult struct {
	pendingSave
	// Files is how many photo files changed.
	Files int `json:"files"`
}

// socialFields are the parts of a photo JSON file SocialCalendar reads.
type socialFields struct {
	File                   *string `json:"file"`
	Title                  *string `json:"title"`
	GPSPosition            *string `json:"gpsPosition"`
	CreateDate             *string `json:"createDate"`
	IsSocialMediaEligible  bool    `json:"isSocialMediaEligible"`
	SocialMediaPublishDate *string `json:"socialMediaPublishDate"`
	// Images holds each version's URL, and also the thumbnail's crop, an
	// object, so its values are only read as strings where they are ones.
	Images map[string]json.RawMessage `json:"images"`
}

// SocialCalendar reads every photo JSON file, as PreviewBaseURL does, with
// its social media publish date. It changes nothing.
func (c *Client) SocialCalendar(ctx context.Context, gh settings.GitHub) (SocialCalendar, error) {
	return c.socialCalendar(ctx, gh, wholeFile)
}

// wholeFile is a photo file's content as it is, for the Instagram calendar.
func wholeFile(content []byte) (json.RawMessage, error) { return content, nil }

// socialCalendar reads every photo JSON file with its social media publish
// date, each photo's Data being what data makes of its file.
func (c *Client) socialCalendar(ctx context.Context, gh settings.GitHub, data func([]byte) (json.RawMessage, error)) (SocialCalendar, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return SocialCalendar{}, perr
	}
	cal := SocialCalendar{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch,
		Photos:     []SocialPhoto{},
		Unreadable: []BaseURLUnreadable{},
	}
	if scan.pr != nil {
		cal.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}

	for _, f := range scan.files {
		if f.err != "" {
			cal.Unreadable = append(cal.Unreadable, BaseURLUnreadable{Path: f.path, Error: f.err})
			continue
		}
		var fields socialFields
		content, err := data(f.content)
		if err == nil {
			err = json.Unmarshal(f.content, &fields)
		}
		if err != nil {
			cal.Unreadable = append(cal.Unreadable, BaseURLUnreadable{Path: f.path, Error: "The file's fields aren't the expected types."})
			continue
		}
		photo := SocialPhoto{
			Path: f.path, FileURL: f.fileURL, GPSPosition: fields.GPSPosition, CreateDate: fields.CreateDate,
			Title: fields.Title, Image: socialImage(fields.Images),
			IsSocialMediaEligible: fields.IsSocialMediaEligible, SocialMediaPublishDate: fields.SocialMediaPublishDate,
			Data: content,
		}
		if fields.File != nil {
			photo.File = *fields.File
		}
		cal.Photos = append(cal.Photos, photo)
	}
	return cal, nil
}

// socialImage is the square thumbnail, or the smallest resized version there is.
func socialImage(images map[string]json.RawMessage) *string {
	for _, name := range []string{"thumbnail", "small", "xsmall", "medium", "large", "xlarge"} {
		var u string
		if json.Unmarshal(images[name], &u) == nil && u != "" {
			return &u
		}
	}
	return nil
}

// SetSocialDates sets the social media publish date of each photo file in
// dates, in the pending changes as ReplaceBaseURL saves them. Only that field
// of each file changes. Nothing is saved when a file can't be read, or when two
// photos would end up on the same day.
func (c *Client) SetSocialDates(ctx context.Context, gh settings.GitHub, dates []SocialDate) (SocialDatesResult, error) {
	want, perr := wantedDates(dates)
	if perr != nil {
		return SocialDatesResult{}, perr
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return SocialDatesResult{}, perr
	}

	var entries []map[string]string
	byDay := map[string]string{}
	for _, f := range scan.files {
		entry, perr := dateEntry(f, want, byDay)
		if perr != nil {
			return SocialDatesResult{}, perr
		}
		if entry != nil {
			entries = append(entries, entry)
		}
	}
	if len(want) > 0 {
		return SocialDatesResult{}, missingPhotoFiles(want, scan.branch)
	}
	if len(entries) == 0 {
		return SocialDatesResult{}, publishErr(http.StatusConflict, "Those publish dates are already saved, so there's nothing to change.")
	}

	saved, perr := c.saveScan(scan, entries)
	if perr != nil {
		return SocialDatesResult{}, perr
	}
	return SocialDatesResult{pendingSave: saved, Files: len(entries)}, nil
}

// wantedDates is each new publish date by photo file path, or an error when a
// path is listed twice or a date isn't YYYY-MM-DD.
func wantedDates(dates []SocialDate) (map[string]*string, *PublishError) {
	if len(dates) == 0 {
		return nil, publishErr(http.StatusBadRequest, "There are no publish dates to save.")
	}
	want := map[string]*string{}
	for _, d := range dates {
		if _, dup := want[d.Path]; dup {
			return nil, publishErr(http.StatusBadRequest, "%s is listed more than once.", d.Path)
		}
		if d.Date != nil {
			if _, err := time.Parse(time.DateOnly, *d.Date); err != nil {
				return nil, publishErr(http.StatusBadRequest, "%q isn't a date like 2026-10-22.", *d.Date)
			}
		}
		want[d.Path] = d.Date
	}
	return want, nil
}

// dateEntry checks one photo file against the dates SetSocialDates is saving.
// It records the file's publish date, new or as saved, in byDay, failing when
// another photo already has that day. When the file is in want it takes it out
// and returns the file's tree entry with the new date, or nil when the date is
// already saved.
func dateEntry(f photoFile, want map[string]*string, byDay map[string]string) (map[string]string, *PublishError) {
	if f.err != "" {
		return nil, publishErr(http.StatusConflict, "%s couldn't be read (%s), so nothing was changed.", f.path, f.err)
	}
	date, changing := want[f.path]
	if !changing {
		date = savedPublishDate(f.content)
	}
	if date != nil {
		if other, taken := byDay[*date]; taken {
			return nil, publishErr(http.StatusConflict,
				"%s and %s would both be posted on %s, so nothing was changed.", other, f.path, *date)
		}
		byDay[*date] = f.path
	}
	if !changing {
		return nil, nil
	}
	delete(want, f.path)
	value := []byte("null")
	if date != nil {
		value, _ = json.Marshal(*date)
	}
	content, err := setTopLevel(f.content, publishDateKey, value)
	if err != nil {
		return nil, publishErr(http.StatusConflict, "%s: %s", f.path, err)
	}
	if bytes.Equal(content, f.content) {
		return nil, nil
	}
	return map[string]string{"path": f.path, "mode": "100644", "type": "blob", "content": string(content)}, nil
}

// savedPublishDate is the social media publish date a photo file already has,
// or nil when it has none or can't be read.
func savedPublishDate(content []byte) *string {
	var fields socialFields
	if json.Unmarshal(content, &fields) != nil {
		return nil
	}
	return fields.SocialMediaPublishDate
}

// missingPhotoFiles is the error for the paths left in want, which aren't
// photo files on branch.
func missingPhotoFiles(want map[string]*string, branch string) *PublishError {
	missing := make([]string, 0, len(want))
	for p := range want {
		missing = append(missing, p)
	}
	sort.Strings(missing)
	return publishErr(http.StatusNotFound,
		"%s isn't a photo file on %s, so nothing was changed.", strings.Join(missing, ", "), branch)
}

// valueOffset is where a value starts in span, which runs from the end of the
// token before it: only whitespace and its key's colon come first.
func valueOffset(span []byte) int {
	return bytes.IndexFunc(span, func(r rune) bool { return r != ':' && r != ' ' && r != '\n' && r != '\r' && r != '\t' })
}

// splice is content with content[start:end] replaced by value.
func splice(content []byte, start, end int, value []byte) []byte {
	return append(append(append([]byte{}, content[:start]...), value...), content[end:]...)
}

func plural(n int, word string) string {
	if n == 1 {
		return word
	}
	return word + "s"
}

// setTopLevel returns content, a JSON object, with its top-level key set to
// value, leaving every other byte as it was. A key that's missing is added
// at the end, indented as Publish writes a photo's file. It fails when the
// key holds an object or array, which a scalar field never should.
func setTopLevel(content []byte, key string, value []byte) ([]byte, error) {
	return replaceTopLevel(content, key, value, false)
}

// setTopLevelList is setTopLevel for a key that holds an array, such as a
// photo's "albums", which it replaces whole.
func setTopLevelList(content []byte, key string, value []byte) ([]byte, error) {
	return replaceTopLevel(content, key, value, true)
}

// replaceTopLevel is setTopLevel, also replacing an object or array the key
// holds when containers is true.
func replaceTopLevel(content []byte, key string, value []byte, containers bool) ([]byte, error) {
	s := &topLevelScan{content: content, key: key, containers: containers, closing: -1, valueStart: -1}
	dec := json.NewDecoder(bytes.NewReader(content))
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, errors.New("the file isn't valid JSON")
		}
		end := int(dec.InputOffset())
		start := s.prev
		s.prev = end
		at, err := s.step(tok, start, end)
		if err != nil {
			return nil, err
		}
		if at >= 0 {
			return splice(content, at, end, value), nil
		}
	}
	if s.closing < 0 {
		return nil, errors.New("the file isn't a JSON object")
	}
	return appendTopLevel(content, s.closing, key, value), nil
}

// topLevelScan follows replaceTopLevel through a JSON object's tokens, one
// step per token, to find where its top-level key's value is.
type topLevelScan struct {
	content    []byte
	key        string
	containers bool
	// depth is how many objects and arrays the current token is inside.
	depth int
	// prev is where the previous token ended, so the current one's span starts there.
	prev int
	// closing is where the top-level object's closing brace is, once it's seen.
	closing int
	// wantKey is true when the next top-level token is a key, and matched
	// when the last key read was the one being set.
	wantKey, matched bool
	// valueStart is where the matched key's object or array value starts.
	valueStart int
}

// step reads one token, spanning content[start:end]. It returns where the
// key's value starts once the token ending at end is the value's last, or -1
// while the value hasn't ended yet.
func (s *topLevelScan) step(tok json.Token, start, end int) (int, error) {
	d, ok := tok.(json.Delim)
	if !ok {
		return s.scalar(tok, start, end), nil
	}
	if d == '{' || d == '[' {
		return -1, s.open(d, start, end)
	}
	return s.close(end), nil
}

// open steps into an object or array, noting where it starts when it's the
// matched key's value.
func (s *topLevelScan) open(d json.Delim, start, end int) error {
	if s.matched && s.depth == 1 {
		if !s.containers {
			return fmt.Errorf("%s isn't a single value", s.key)
		}
		s.valueStart = start + valueOffset(s.content[start:end])
	}
	if s.depth == 0 && d != '{' {
		return errors.New("the file isn't a JSON object")
	}
	s.depth++
	s.wantKey = s.depth == 1
	return nil
}

// close steps out of an object or array, returning where the matched key's
// value started when this closes it.
func (s *topLevelScan) close(end int) int {
	s.depth--
	if s.depth == 1 && s.matched && s.valueStart >= 0 {
		return s.valueStart
	}
	if s.depth == 0 {
		s.closing = end - 1
	}
	s.wantKey = s.depth == 1
	return -1
}

// scalar reads a key, string, number, boolean or null, returning where it
// starts when it's the matched key's value.
func (s *topLevelScan) scalar(tok json.Token, start, end int) int {
	if s.depth != 1 {
		return -1
	}
	if s.wantKey {
		s.matched = tok == s.key
		s.wantKey = false
		return -1
	}
	s.wantKey = true
	if s.matched {
		return start + valueOffset(s.content[start:end])
	}
	return -1
}

// appendTopLevel is content, a JSON object whose closing brace is at closing,
// with key added as its last field, indented as Publish writes a photo's file.
func appendTopLevel(content []byte, closing int, key string, value []byte) []byte {
	last := bytes.LastIndexFunc(content[:closing], func(r rune) bool { return r != ' ' && r != '\n' && r != '\r' && r != '\t' })
	field := fmt.Sprintf(`  %q: %s`, key, value)
	var out bytes.Buffer
	out.Write(content[:last+1])
	if content[last] == '{' {
		out.WriteString("\n" + field + "\n")
	} else {
		out.WriteString(",\n" + field)
		out.Write(content[last+1 : closing])
	}
	out.Write(content[closing:])
	return out.Bytes()
}
