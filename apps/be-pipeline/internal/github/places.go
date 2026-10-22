package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// EntryKind is a kind of data file the pipeline saves whole, by ID: places
// and localizations. Each is one JSON file in its kind's folder, and Commit
// combines them into the kind's AllFile.
type EntryKind struct {
	// Name is the kind's singular name, as shown: "place" or "localization".
	Name string
	// Folder is the data folder's subfolder of the kind's files.
	Folder string
	// AllFile is the combined list of the kind's files.
	AllFile string
}

// The entry kinds. A photo lists its places by ID in its "places" key; a
// localization notes how a country, city or place is written and said.
var (
	Places        = EntryKind{Name: "place", Folder: "places", AllFile: "PLACES.json"}
	Localizations = EntryKind{Name: "localization", Folder: "localizations", AllFile: "LOCALIZATIONS.json"}
	entryKinds    = []EntryKind{Places, Localizations}
)

// EntryKindByFolder returns the entry kind whose folder is folder, such as
// "places".
func EntryKindByFolder(folder string) (EntryKind, bool) {
	for _, k := range entryKinds {
		if k.Folder == folder {
			return k, true
		}
	}
	return EntryKind{}, false
}

const maxEntryTextLength = 200

// Place is a place file: somewhere a photo was taken, more exactly than its
// city, such as Gyeongbokgung Palace.
type Place struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Localization types: what a localization is of.
const (
	LocalizationCountry = "country"
	LocalizationCity    = "city"
	LocalizationPlace   = "place"
)

// Localization is a localization file: how a country, city or place is
// written and said where it is.
type Localization struct {
	ID string `json:"id"`
	// Type is LocalizationCountry, LocalizationCity or LocalizationPlace.
	Type string `json:"type"`
	// Name is the country's or city's name as photos list it, or the
	// place's name.
	Name string `json:"name"`
	// Romanization is the name in Latin letters, such as Gyeongbokgung.
	Romanization string `json:"romanization"`
	// Pronunciation is how the local script is read, such as furigana for
	// kanji.
	Pronunciation string `json:"pronunciation"`
	// LocalScript is the name in its own script, such as 경복궁 in hangeul.
	LocalScript string `json:"localScript"`
}

// Entry is one place or localization file, as read.
type Entry struct {
	Path string `json:"path"`
	// Data is the file's JSON, when it could be read.
	Data json.RawMessage `json:"data,omitempty"`
	// Error says why the file couldn't be read.
	Error string `json:"error,omitempty"`
}

// EntriesResult is every place and localization file at the open photo data
// pull request's head, or on the base branch when none is open.
type EntriesResult struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch is where the files were read.
	Branch string `json:"branch"`
	// PullRequest is nil when no photo data pull request is open.
	PullRequest   *InFlightPullRequest `json:"pullRequest"`
	Places        []Entry              `json:"places"`
	Localizations []Entry              `json:"localizations"`
}

// EntryResult says where a place or localization was saved.
type EntryResult struct {
	scanCommit
	Path string `json:"path"`
	// Data is the file as saved.
	Data json.RawMessage `json:"data"`
	// Before is the file before, or null when it's new.
	Before json.RawMessage `json:"before"`
	// Changed is false when the file already had that content, so nothing
	// was committed.
	Changed bool `json:"changed"`
}

// Entries reads every place and localization file at the open photo data
// pull request's head, or on the base branch when none is open, so they're
// listed whether or not Commit has combined them yet. It only reads from
// GitHub.
func (c *Client) Entries(ctx context.Context, gh settings.GitHub) (EntriesResult, error) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return EntriesResult{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return EntriesResult{}, perr
	}
	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return EntriesResult{}, perr
	}
	result := EntriesResult{Repo: t.repo.FullName, Folder: root, Branch: t.base}
	ref := t.base
	if pr != nil {
		result.Branch, ref = pr.Head.Ref, pr.Head.SHA
		result.PullRequest = &InFlightPullRequest{Number: pr.Number, Title: pr.Title, URL: pr.HTMLURL, Branch: pr.Head.Ref, HeadSHA: pr.Head.SHA}
	}
	if result.Places, perr = c.readEntries(ctx, t, root, Places, ref); perr != nil {
		return EntriesResult{}, perr
	}
	if result.Localizations, perr = c.readEntries(ctx, t, root, Localizations, ref); perr != nil {
		return EntriesResult{}, perr
	}
	return result, nil
}

// readEntries reads kind's files in the data folder root at ref, by path.
func (c *Client) readEntries(ctx context.Context, t target, root string, kind EntryKind, ref string) ([]Entry, *PublishError) {
	files, _, perr := c.listJSONFiles(ctx, t, root+"/"+kind.Folder, kind.AllFile, ref)
	if perr != nil {
		return nil, perr
	}
	contents, problems := c.readBlobs(ctx, t, files)
	entries := make([]Entry, len(files))
	for i, f := range files {
		entries[i] = Entry{Path: f.Path, Data: contents[i], Error: problems[i]}
	}
	return entries, nil
}

// readBlobs reads each of files' JSON, or says why it couldn't, a few at a
// time.
func (c *Client) readBlobs(ctx context.Context, t target, files []folderEntry) ([]json.RawMessage, []string) {
	contents := make([]json.RawMessage, len(files))
	problems := make([]string, len(files))
	var wg sync.WaitGroup
	sem := make(chan struct{}, readConcurrency)
	for i, f := range files {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			contents[i], problems[i] = c.readBlob(ctx, t, f.SHA)
		}()
	}
	wg.Wait()
	return contents, problems
}

// SavePlace saves place as <folder>/places/<id>.json, new or replacing the
// one there, as one commit on the open photo data pull request's branch, or
// a new one with its pull request. It fails when another place has the same
// name, ignoring case.
func (c *Client) SavePlace(ctx context.Context, gh settings.GitHub, place Place) (EntryResult, error) {
	place, perr := validPlace(place)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, Places, place.ID, place, func(others []Entry) *PublishError {
		return placeNameTaken(others, place)
	})
}

// SaveLocalization saves localization as <folder>/localizations/<id>.json,
// new or replacing the one there, as SavePlace does.
func (c *Client) SaveLocalization(ctx context.Context, gh settings.GitHub, localization Localization) (EntryResult, error) {
	localization, perr := validLocalization(localization)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, Localizations, localization.ID, localization, func([]Entry) *PublishError { return nil })
}

// saveEntry commits content as kind's file named id, after check passes on
// the kind's other files.
func (c *Client) saveEntry(ctx context.Context, gh settings.GitHub, kind EntryKind, id string, content any, check func(others []Entry) *PublishError) (EntryResult, error) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return EntryResult{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	scan, perr := c.combinedTarget(ctx, t, true)
	if perr != nil {
		return EntryResult{}, perr
	}
	entries, perr := c.readEntries(ctx, t, root, kind, scan.headSHA)
	if perr != nil {
		return EntryResult{}, perr
	}
	file := root + "/" + kind.Folder + "/" + id + ".json"
	before, others := splitEntry(entries, file)
	if perr := check(others); perr != nil {
		return EntryResult{}, perr
	}
	b, err := json.MarshalIndent(content, "", "  ")
	if err != nil {
		return EntryResult{}, publishErr(http.StatusInternalServerError, "Couldn't encode the %s.", kind.Name)
	}
	b = append(b, '\n')
	result := EntryResult{Path: file, Data: b, Before: before}
	if bytes.Equal(before, b) {
		return result, nil
	}
	message := "Add " + kind.Name + " " + file
	if before != nil {
		message = "Change " + kind.Name + " " + file
	}
	entry := []map[string]string{{"path": file, "mode": "100644", "type": "blob", "content": string(b)}}
	if result.scanCommit, perr = c.commitScan(ctx, scan, entry, message); perr != nil {
		return EntryResult{}, perr
	}
	result.Changes = []ScanChange{{Path: file, Before: before, After: b}}
	result.Changed = true
	return result, nil
}

// splitEntry returns the content of the entry at file, or nil when there's
// none, and the other entries.
func splitEntry(entries []Entry, file string) (json.RawMessage, []Entry) {
	i := slices.IndexFunc(entries, func(e Entry) bool { return e.Path == file })
	if i == -1 {
		return nil, entries
	}
	return entries[i].Data, slices.Delete(slices.Clone(entries), i, i+1)
}

// placeNameTaken fails when another place in others has place's name,
// ignoring case and surrounding spaces.
func placeNameTaken(others []Entry, place Place) *PublishError {
	for _, e := range others {
		var other Place
		if json.Unmarshal(e.Data, &other) != nil {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(other.Name), place.Name) {
			return publishErr(http.StatusConflict, "There's already a place named %q (%s). Pick another name.", other.Name, e.Path)
		}
	}
	return nil
}

// validPlace checks place and returns it trimmed, as it will be saved.
func validPlace(place Place) (Place, *PublishError) {
	p := Place{ID: strings.TrimSpace(place.ID), Name: strings.TrimSpace(place.Name), Description: strings.TrimSpace(place.Description)}
	if perr := validEntryID("place", p.ID); perr != nil {
		return p, perr
	}
	if p.Name == "" {
		return p, publishErr(http.StatusBadRequest, "Give the place a name.")
	}
	if utf8.RuneCountInString(p.Name) > maxGroupNameLength {
		return p, publishErr(http.StatusBadRequest, "Keep the name to %d characters.", maxGroupNameLength)
	}
	if utf8.RuneCountInString(p.Description) > maxGroupDescriptionLength {
		return p, publishErr(http.StatusBadRequest, "Keep the description to %d characters.", maxGroupDescriptionLength)
	}
	return p, nil
}

// validLocalization checks l and returns it trimmed, as it will be saved.
func validLocalization(l Localization) (Localization, *PublishError) {
	out := Localization{
		ID: strings.TrimSpace(l.ID), Type: strings.TrimSpace(l.Type), Name: strings.TrimSpace(l.Name),
		Romanization: strings.TrimSpace(l.Romanization), Pronunciation: strings.TrimSpace(l.Pronunciation),
		LocalScript: strings.TrimSpace(l.LocalScript),
	}
	if perr := validEntryID("localization", out.ID); perr != nil {
		return out, perr
	}
	if !slices.Contains([]string{LocalizationCountry, LocalizationCity, LocalizationPlace}, out.Type) {
		return out, publishErr(http.StatusBadRequest, "A localization's type is country, city or place.")
	}
	if out.Name == "" {
		return out, publishErr(http.StatusBadRequest, "Say which %s the localization is for.", out.Type)
	}
	for _, s := range []string{out.Name, out.Romanization, out.Pronunciation, out.LocalScript} {
		if utf8.RuneCountInString(s) > maxEntryTextLength {
			return out, publishErr(http.StatusBadRequest, "Keep each field to %d characters.", maxEntryTextLength)
		}
	}
	return out, nil
}

// validEntryID fails unless id is lowercase letters, numbers and single
// dashes, which is also its file name.
func validEntryID(kind, id string) *PublishError {
	if len(id) > maxGroupIDLength || !groupIDPattern.MatchString(id) {
		return publishErr(http.StatusBadRequest,
			"Use a %s ID of up to %d lowercase letters and numbers, with single dashes between words.", kind, maxGroupIDLength)
	}
	return nil
}
