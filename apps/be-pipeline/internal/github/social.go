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
	// File is the photo's original file name.
	File  string  `json:"file"`
	Title *string `json:"title"`
	// Image is the photo's square thumbnail, or else its smallest resized
	// version; nil when it has none.
	Image                  *string `json:"image"`
	IsSocialMediaEligible  bool    `json:"isSocialMediaEligible"`
	SocialMediaPublishDate *string `json:"socialMediaPublishDate"`
	// InAllPhotos is true when the photo is an entry of ALLPHOTOS.json on the
	// base branch, so it's already in the portfolio.
	InAllPhotos bool `json:"inAllPhotos"`
}

// SocialCalendar is every photo file with its social media publish date.
type SocialCalendar struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch is where the photo files were read, as for BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	// AllPhotos is ALLPHOTOS.json on the base branch, without its data.
	AllPhotos  InFlightAllPhotos   `json:"allPhotos"`
	Photos     []SocialPhoto       `json:"photos"`
	Unreadable []BaseURLUnreadable `json:"unreadable"`
}

// SocialDate sets the publish date of the photo file at Path. A nil Date
// clears it.
type SocialDate struct {
	Path string  `json:"path"`
	Date *string `json:"date"`
}

// SocialDatesResult says where publish date changes were committed.
type SocialDatesResult struct {
	scanCommit
	// Files is how many photo files changed.
	Files int `json:"files"`
}

// socialFields are the parts of a photo JSON file SocialCalendar reads.
type socialFields struct {
	File                   *string            `json:"file"`
	Title                  *string            `json:"title"`
	GPSPosition            *string            `json:"gpsPosition"`
	CreateDate             *string            `json:"createDate"`
	IsSocialMediaEligible  bool               `json:"isSocialMediaEligible"`
	SocialMediaPublishDate *string            `json:"socialMediaPublishDate"`
	Images                 map[string]*string `json:"images"`
}

// SocialCalendar reads every photo JSON file, as PreviewBaseURL does, with
// its social media publish date and whether it's in ALLPHOTOS.json on the
// base branch. It only reads from GitHub.
func (c *Client) SocialCalendar(ctx context.Context, gh settings.GitHub) (SocialCalendar, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return SocialCalendar{}, perr
	}
	cal := SocialCalendar{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch,
		AllPhotos:  InFlightAllPhotos{Path: scan.folder + "/" + AllPhotosFile},
		Photos:     []SocialPhoto{},
		Unreadable: []BaseURLUnreadable{},
	}
	if scan.pr != nil {
		cal.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	found, entries, msg := c.readAllPhotosEntries(ctx, scan.t, cal.AllPhotos.Path, scan.t.base)
	cal.AllPhotos.Found, cal.AllPhotos.Count, cal.AllPhotos.Error = found, len(entries), msg
	if found {
		cal.AllPhotos.FileURL = "https://github.com/" + scan.t.repo.FullName + "/blob/" + escapePath(scan.t.base) + "/" + escapePath(cal.AllPhotos.Path)
	}

	for _, f := range scan.files {
		if f.err != "" {
			cal.Unreadable = append(cal.Unreadable, BaseURLUnreadable{Path: f.path, Error: f.err})
			continue
		}
		var fields socialFields
		if err := json.Unmarshal(f.content, &fields); err != nil {
			cal.Unreadable = append(cal.Unreadable, BaseURLUnreadable{Path: f.path, Error: "The file's fields aren't the expected types."})
			continue
		}
		photo := SocialPhoto{
			Path: f.path, FileURL: f.fileURL, Title: fields.Title, Image: socialImage(fields.Images),
			IsSocialMediaEligible: fields.IsSocialMediaEligible, SocialMediaPublishDate: fields.SocialMediaPublishDate,
		}
		if fields.File != nil {
			photo.File = *fields.File
			identity := PhotoIdentity{File: *fields.File, GPSPosition: fields.GPSPosition, CreateDate: fields.CreateDate}
			for _, e := range entries {
				if sameIdentity(e, identity) {
					photo.InAllPhotos = true
					break
				}
			}
		}
		cal.Photos = append(cal.Photos, photo)
	}
	return cal, nil
}

// socialImage is the square thumbnail, or the smallest resized version there is.
func socialImage(images map[string]*string) *string {
	for _, name := range []string{"thumbnail", "small", "xsmall", "medium", "large", "xlarge"} {
		if u := images[name]; u != nil && *u != "" {
			return u
		}
	}
	return nil
}

// SetSocialDates sets the social media publish date of each photo file in
// dates, as one commit, where ReplaceBaseURL commits. Only that field of each
// file changes. Nothing is committed when a file can't be read, or when two
// photos would end up on the same day.
func (c *Client) SetSocialDates(ctx context.Context, gh settings.GitHub, dates []SocialDate) (SocialDatesResult, error) {
	if len(dates) == 0 {
		return SocialDatesResult{}, publishErr(http.StatusBadRequest, "There are no publish dates to save.")
	}
	want := map[string]*string{}
	for _, d := range dates {
		if _, dup := want[d.Path]; dup {
			return SocialDatesResult{}, publishErr(http.StatusBadRequest, "%s is listed more than once.", d.Path)
		}
		if d.Date != nil {
			if _, err := time.Parse(time.DateOnly, *d.Date); err != nil {
				return SocialDatesResult{}, publishErr(http.StatusBadRequest, "%q isn't a date like 2026-10-22.", *d.Date)
			}
		}
		want[d.Path] = d.Date
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return SocialDatesResult{}, perr
	}

	var entries []map[string]string
	byDay := map[string]string{}
	for _, f := range scan.files {
		date, changing := want[f.path]
		if f.err != "" {
			return SocialDatesResult{}, publishErr(http.StatusConflict,
				"%s couldn't be read (%s), so nothing was changed.", f.path, f.err)
		}
		if !changing {
			var fields socialFields
			if json.Unmarshal(f.content, &fields) == nil {
				date = fields.SocialMediaPublishDate
			}
		}
		if date != nil {
			if other, taken := byDay[*date]; taken {
				return SocialDatesResult{}, publishErr(http.StatusConflict,
					"%s and %s would both be posted on %s, so nothing was changed.", other, f.path, *date)
			}
			byDay[*date] = f.path
		}
		if !changing {
			continue
		}
		delete(want, f.path)
		value := []byte("null")
		if date != nil {
			value, _ = json.Marshal(*date)
		}
		content, err := setTopLevel(f.content, publishDateKey, value)
		if err != nil {
			return SocialDatesResult{}, publishErr(http.StatusConflict, "%s: %s", f.path, err)
		}
		if bytes.Equal(content, f.content) {
			continue
		}
		entries = append(entries, map[string]string{"path": f.path, "mode": "100644", "type": "blob", "content": string(content)})
	}
	if len(want) > 0 {
		missing := make([]string, 0, len(want))
		for p := range want {
			missing = append(missing, p)
		}
		sort.Strings(missing)
		return SocialDatesResult{}, publishErr(http.StatusNotFound,
			"%s isn't a photo file on %s, so nothing was changed.", strings.Join(missing, ", "), scan.branch)
	}
	if len(entries) == 0 {
		return SocialDatesResult{}, publishErr(http.StatusConflict, "Those publish dates are already saved, so there's nothing to change.")
	}

	message := fmt.Sprintf("Schedule social media posts for %d %s", len(entries), plural(len(entries), "photo"))
	saved, perr := c.commitScan(ctx, scan, entries, message)
	if perr != nil {
		return SocialDatesResult{}, perr
	}
	return SocialDatesResult{scanCommit: saved, Files: len(entries)}, nil
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
	dec := json.NewDecoder(bytes.NewReader(content))
	depth, prev, closing := 0, 0, -1
	wantKey, matched := false, false
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, errors.New("the file isn't valid JSON")
		}
		end := int(dec.InputOffset())
		start := prev
		prev = end

		if d, ok := tok.(json.Delim); ok {
			if d == '{' || d == '[' {
				if matched {
					return nil, fmt.Errorf("%s isn't a single value", key)
				}
				if depth == 0 && d != '{' {
					return nil, errors.New("the file isn't a JSON object")
				}
				depth++
				wantKey = depth == 1
				continue
			}
			depth--
			if depth == 0 {
				closing = end - 1
			}
			wantKey = depth == 1
			continue
		}
		if depth != 1 {
			continue
		}
		if wantKey {
			matched = tok == key
			wantKey = false
			continue
		}
		wantKey = true
		if matched {
			// Before a value come only whitespace and its key's colon.
			start += bytes.IndexFunc(content[start:end], func(r rune) bool { return r != ':' && r != ' ' && r != '\n' && r != '\r' && r != '\t' })
			return append(append(append([]byte{}, content[:start]...), value...), content[end:]...), nil
		}
	}
	if closing < 0 {
		return nil, errors.New("the file isn't a JSON object")
	}

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
	return out.Bytes(), nil
}
