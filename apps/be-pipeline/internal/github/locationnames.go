package github

import (
	"context"
	"encoding/json"
	"maps"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxOtherNames is how many other names one country or city can have.
const maxOtherNames = 50

// LocationNames are the names that win over other ways of writing a country
// or city, from the localizations' OtherNames: by localization type, then by
// the other name (see nameKey), the name that wins.
type LocationNames map[string]map[string]string

// photoLocationFields are the photo JSON fields with a country or city in
// them, and which.
var photoLocationFields = map[string]string{
	"country": LocalizationCountry, "customCountry": LocalizationCountry,
	"city": LocalizationCity, "customCity": LocalizationCity,
}

// placeLocationFields are the place file fields with a country or city in
// them, and which.
var placeLocationFields = map[string]string{"country": LocalizationCountry, "city": LocalizationCity}

// nameKey is name as other names are matched: trimmed, ignoring case.
func nameKey(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// parseLocationNames is the other names of the country and city
// localizations in entries that can be read.
func parseLocationNames(entries []Entry) LocationNames {
	names := LocationNames{}
	for _, l := range parseLocalizations(entries) {
		for _, other := range l.OtherNames {
			if names[l.Type] == nil {
				names[l.Type] = map[string]string{}
			}
			names[l.Type][nameKey(other)] = l.Name
		}
	}
	return names
}

// parseLocalizations is the localizations in entries that can be read.
func parseLocalizations(entries []Entry) []Localization {
	var out []Localization
	for _, e := range entries {
		var l Localization
		if json.Unmarshal(e.Data, &l) == nil && l.Name != "" {
			out = append(out, l)
		}
	}
	return out
}

// winner is the name that wins over name, a country or city as typ says,
// and whether name is another name of one.
func (n LocationNames) winner(typ, name string) (string, bool) {
	w, ok := n[typ][nameKey(name)]
	return w, ok
}

// count is how many other names there are.
func (n LocationNames) count() int {
	total := 0
	for _, names := range n {
		total += len(names)
	}
	return total
}

// Apply is s with each country and city that's another name of one written
// as the name that wins, as a new photo's JSON gets them.
func (n LocationNames) Apply(s exif.Sanitized) exif.Sanitized {
	for _, f := range []struct {
		value **string
		typ   string
	}{
		{&s.Country, LocalizationCountry}, {&s.CustomCountry, LocalizationCountry},
		{&s.City, LocalizationCity}, {&s.CustomCity, LocalizationCity},
	} {
		if *f.value == nil {
			continue
		}
		if w, ok := n.winner(f.typ, **f.value); ok {
			*f.value = &w
		}
	}
	return s
}

// renamedFields is the changes the location names make to fields, a file's
// top-level JSON values, among the location fields it has.
func (n LocationNames) renamedFields(fields map[string]json.RawMessage, locationFields map[string]string) []FieldChange {
	var changes []FieldChange
	for _, field := range slices.Sorted(maps.Keys(locationFields)) {
		var name string
		if json.Unmarshal(fields[field], &name) != nil {
			continue
		}
		if w, ok := n.winner(locationFields[field], name); ok && w != name {
			to, _ := json.Marshal(w)
			changes = append(changes, FieldChange{Field: field, From: compactOrNull(fields[field]), To: to})
		}
	}
	return changes
}

// cleanOtherNames is l's other names trimmed, without empty ones and ones
// already listed or the same as its name, ignoring case. Only a country or
// city has them.
func cleanOtherNames(l Localization, names []string) ([]string, *PublishError) {
	var out []string
	seen := map[string]bool{nameKey(l.Name): true}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" || seen[nameKey(name)] {
			continue
		}
		seen[nameKey(name)] = true
		out = append(out, name)
	}
	switch {
	case len(out) > 0 && l.Type == LocalizationPlace:
		return nil, publishErr(http.StatusBadRequest, "Only a country or city has other names.")
	case len(out) > maxOtherNames:
		return nil, publishErr(http.StatusBadRequest, "Keep a %s to %d other names.", l.Type, maxOtherNames)
	}
	return out, otherNameTooLong(out)
}

// otherNameTooLong fails when a name is over maxEntryTextLength.
func otherNameTooLong(names []string) *PublishError {
	for _, name := range names {
		if utf8.RuneCountInString(name) > maxEntryTextLength {
			return publishErr(http.StatusBadRequest, "Keep each other name to %d characters.", maxEntryTextLength)
		}
	}
	return nil
}

// otherNamesTaken fails when one of l's other names is already another name
// of a country or city in others, or has other names of its own, or l
// itself is another's other name while having its own.
func otherNamesTaken(others []Entry, l Localization) *PublishError {
	if len(l.OtherNames) == 0 {
		return nil
	}
	mine := map[string]bool{}
	for _, name := range l.OtherNames {
		mine[nameKey(name)] = true
	}
	for _, o := range parseLocalizations(others) {
		if o.Type != l.Type {
			continue
		}
		if perr := otherNameClash(o, l, mine); perr != nil {
			return perr
		}
	}
	return nil
}

// otherNameClash is otherNamesTaken for one other localization o.
func otherNameClash(o, l Localization, mine map[string]bool) *PublishError {
	if mine[nameKey(o.Name)] && len(o.OtherNames) > 0 {
		return publishErr(http.StatusConflict, "%s has other names of its own, so it can't be another name for %s. Remove them first.", o.Name, l.Name)
	}
	for _, name := range o.OtherNames {
		if mine[nameKey(name)] {
			return publishErr(http.StatusConflict, "%s is already another name for %s.", name, o.Name)
		}
		if nameKey(name) == nameKey(l.Name) {
			return publishErr(http.StatusConflict, "%s is another name for %s, so it can't have other names of its own.", l.Name, o.Name)
		}
	}
	return nil
}

// LocationNameFile is a photo or place file whose countries or cities the
// location names rewrite.
type LocationNameFile struct {
	Path    string `json:"path"`
	FileURL string `json:"fileUrl,omitempty"`
	// Kind is "photo" or "place".
	Kind    string        `json:"kind"`
	Changes []FieldChange `json:"changes"`
}

// LocationNamesPreview is what writing every country and city as the name
// that wins over it would do to the photo and place files on Branch.
type LocationNamesPreview struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	PlaceFiles  int                 `json:"placeFiles"`
	// OtherNames is how many other names the countries and cities have.
	OtherNames int                 `json:"otherNames"`
	Files      []LocationNameFile  `json:"files"`
	Unreadable []BaseURLUnreadable `json:"unreadable"`
}

// LocationNamesResult says where the files the location names changed were
// saved: in the pending changes, for the next Commit.
type LocationNamesResult struct {
	pendingSave
	Files  int `json:"files"`
	Fields int `json:"fields"`
}

// locationScan is every photo and place file, as the next Commit will have
// them, with the changes the location names make to them.
type locationScan struct {
	scan    baseURLScan
	names   LocationNames
	places  []Entry
	files   []LocationNameFile
	content map[string][]byte
}

// scanLocationNames reads every photo and place file and works out the
// changes the location names make to them.
func (c *Client) scanLocationNames(ctx context.Context, gh settings.GitHub) (locationScan, *PublishError) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return locationScan{}, perr
	}
	ls := locationScan{
		scan: scan, names: parseLocationNames(scan.w.entries(Localizations)), places: scan.w.entries(Places),
		content: map[string][]byte{},
	}
	for _, f := range scan.files {
		if f.err == "" {
			ls.add(f.path, f.fileURL, "photo", f.content, photoLocationFields)
		}
	}
	for _, e := range ls.places {
		if e.Error == "" {
			ls.add(e.Path, "", "place", e.Data, placeLocationFields)
		}
	}
	return ls, nil
}

// add lists the file at path when the location names change it.
func (ls *locationScan) add(path, fileURL, kind string, content []byte, fields map[string]string) {
	var values map[string]json.RawMessage
	if json.Unmarshal(content, &values) != nil {
		return
	}
	if changes := ls.names.renamedFields(values, fields); len(changes) > 0 {
		ls.files = append(ls.files, LocationNameFile{Path: path, FileURL: fileURL, Kind: kind, Changes: changes})
		ls.content[path] = content
	}
}

// unreadable is every photo and place file that couldn't be read.
func (ls locationScan) unreadable() []BaseURLUnreadable {
	out := []BaseURLUnreadable{}
	for _, f := range ls.scan.files {
		if f.err != "" {
			out = append(out, BaseURLUnreadable{Path: f.path, Error: f.err})
		}
	}
	for _, e := range ls.places {
		if e.Error != "" {
			out = append(out, BaseURLUnreadable{Path: e.Path, Error: e.Error})
		}
	}
	return out
}

// PreviewLocationNames reads every photo and place file, as PreviewBaseURL
// does, and lists the countries and cities in each that are another name of
// one, with the name that wins over them. It only reads.
func (c *Client) PreviewLocationNames(ctx context.Context, gh settings.GitHub) (LocationNamesPreview, error) {
	ls, perr := c.scanLocationNames(ctx, gh)
	if perr != nil {
		return LocationNamesPreview{}, perr
	}
	scan := ls.scan
	unreadable := ls.unreadable()
	preview := LocationNamesPreview{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch, OtherNames: ls.names.count(),
		PhotoFiles: len(scan.files), PlaceFiles: len(ls.places), Files: ls.files, Unreadable: unreadable,
	}
	if preview.Files == nil {
		preview.Files = []LocationNameFile{}
	}
	if scan.pr != nil {
		preview.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	return preview, nil
}

// ApplyLocationNames makes the changes PreviewLocationNames lists, in the
// pending changes, leaving the rest of each file byte for byte. Nothing is
// saved when any photo or place file can't be read.
func (c *Client) ApplyLocationNames(ctx context.Context, gh settings.GitHub) (LocationNamesResult, error) {
	ls, perr := c.scanLocationNames(ctx, gh)
	if perr != nil {
		return LocationNamesResult{}, perr
	}
	if bad := ls.unreadable(); len(bad) > 0 {
		return LocationNamesResult{}, publishErr(http.StatusConflict,
			"%s couldn't be read (%s), so nothing was changed.", bad[0].Path, bad[0].Error)
	}
	if len(ls.files) == 0 {
		return LocationNamesResult{}, publishErr(http.StatusConflict, "Every country and city is already written as the name that wins, so there's nothing to change.")
	}
	result := LocationNamesResult{}
	changes := make([]ScanChange, 0, len(ls.files))
	for _, file := range ls.files {
		before := ls.content[file.Path]
		after, err := applyEdit(before, fieldEdit(OverrideFile{Path: file.Path, Changes: file.Changes}))
		if err != nil {
			return LocationNamesResult{}, publishErr(http.StatusConflict, "%s couldn't be changed: %v.", file.Path, err)
		}
		changes = append(changes, ScanChange{Path: file.Path, Before: before, After: after})
		result.Files++
		result.Fields += len(file.Changes)
	}
	if result.pendingSave, perr = c.saveFiles(ls.scan.w, changes); perr != nil {
		return LocationNamesResult{}, perr
	}
	return result, nil
}

// ExifOverrides are what a new photo's sanitized EXIF gets made over it: the
// camera overrides, then the names that win over other ways of writing its
// country and city.
type ExifOverrides struct {
	Cameras []CameraOverride
	Names   LocationNames
}

// Apply is s with the overrides made over it.
func (o ExifOverrides) Apply(s exif.Sanitized) exif.Sanitized {
	return o.Names.Apply(ApplyCameraOverrides(o.Cameras, s))
}

// ExifOverrides are the camera overrides and location names as the next
// Commit will have them, so a photo read now gets the ones saved and not
// committed yet.
func (c *Client) ExifOverrides(ctx context.Context, gh settings.GitHub) (ExifOverrides, error) {
	if perr := setUp(gh); perr != nil {
		return ExifOverrides{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return ExifOverrides{}, perr
	}
	return ExifOverrides{
		Cameras: parseOverrides(w.entries(Cameras)), Names: parseLocationNames(w.entries(Localizations)),
	}, nil
}
