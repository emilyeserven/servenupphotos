package github

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// EntryKind is a kind of data file the pipeline saves whole, by ID: places,
// localizations, metadata groups, camera overrides and custom lenses. Each is one JSON file in its kind's folder, and Commit
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
// localization notes how a country, city or place is written and said; a
// metadata group names a set of values of one EXIF field, such as wide-angle
// focal lengths; a camera override renames one camera's EXIF values, such as
// its lens, in the photos taken with it; a custom lens is one EXIF doesn't
// name, such as a manual lens, which a photo can be given on the Photo page.
var (
	Places        = EntryKind{Name: "place", Folder: "places", AllFile: "PLACES.json"}
	Localizations = EntryKind{Name: "localization", Folder: "localizations", AllFile: "LOCALIZATIONS.json"}
	MetaInfo      = EntryKind{Name: "metadata group", Folder: "metainfo", AllFile: "METAINFO.json"}
	Cameras       = EntryKind{Name: "camera override", Folder: "cameras", AllFile: "CAMERAS.json"}
	Lenses        = EntryKind{Name: "custom lens", Folder: "lenses", AllFile: "LENSES.json"}
	entryKinds    = []EntryKind{Places, Localizations, MetaInfo, Cameras, Lenses}
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
	// Parent is the ID of the less specific place this one is in, such as
	// Gyeongbokgung Palace for Geunjeongmun Gate; "" for none.
	Parent string `json:"parent"`
	// City and Country are where the place is, which a photo given the place
	// takes as its city and country; "" when not set.
	City    string `json:"city"`
	Country string `json:"country"`
	// Latitude and Longitude are the place's GPS position in decimal degrees,
	// which a photo given the place uses on the map when its EXIF has none;
	// both nil when not set.
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
	// ExactLocation is whether the GPS position is exactly where photos given
	// the place were taken, such as a subway station or a museum, rather than
	// somewhere near; the portfolio's map then marks them like photos with
	// their own GPS position. Only kept when the place has a GPS position.
	ExactLocation bool `json:"exactLocation,omitempty"`
	// ParentRelation is the word between this place and the place it's in
	// when a photo shows both, such as "in" or "," ("Astoria, Queens"); ""
	// for the parent's ChildRelation. Only kept when the place has a parent.
	ParentRelation string `json:"parentRelation,omitempty"`
	// ChildRelation is the word between each place in this one and this one,
	// unless that place sets its own ParentRelation; "" for "in".
	ChildRelation string `json:"childRelation,omitempty"`
}

// placeRelations are the words a place can be joined to the place it's in
// with: the relations a photo can have to a place, and "," for a comma,
// as in "Astoria, Queens".
var placeRelations = []string{
	"in", "at", "by", "near", "on", "inside", "outside", "behind", "in front of", "across from", "above", "below",
	"overlooking", "from", ",",
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
	// OtherNames are other ways photos and places write a country or city,
	// such as "United States" for "United States of America". Name wins over
	// them: Update Data's Location names rewrites them to it.
	OtherNames []string `json:"otherNames,omitempty"`
}

// Entry is one place or localization file, as read.
type Entry struct {
	Path string `json:"path"`
	// Data is the file's JSON, when it could be read.
	Data json.RawMessage `json:"data,omitempty"`
	// Error says why the file couldn't be read.
	Error string `json:"error,omitempty"`
}

// EntriesResult is every place and localization file as the next Commit
// will have it: at the open photo data pull request's head, or on the base
// branch when none is open, with the pending changes.
type EntriesResult struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch is where the next Commit commits them.
	Branch string `json:"branch"`
	// PullRequest is nil when no photo data pull request is open.
	PullRequest   *InFlightPullRequest `json:"pullRequest"`
	Places        []Entry              `json:"places"`
	Localizations []Entry              `json:"localizations"`
}

// EntryResult says where a place or localization was saved.
type EntryResult struct {
	pendingSave
	Path string `json:"path"`
	// Data is the file as saved.
	Data json.RawMessage `json:"data"`
	// Before is the file before, or null when it's new.
	Before json.RawMessage `json:"before"`
	// Changed is false when the file already had that content, so nothing
	// was saved.
	Changed bool `json:"changed"`
}

// Entries lists every place and localization file as the next Commit will
// have them, so they're listed whether or not Commit has combined them yet.
func (c *Client) Entries(ctx context.Context, gh settings.GitHub) (EntriesResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntriesResult{}, perr
	}
	return EntriesResult{
		Repo: w.t.repo.FullName, Folder: w.root, Branch: w.branch(), PullRequest: w.inFlightPullRequest(),
		Places: w.entries(Places), Localizations: w.entries(Localizations),
	}, nil
}

// entries is kind's files, by path.
func (w *workspace) entries(kind EntryKind) []Entry {
	paths := w.paths(w.root+"/"+kind.Folder, kind.AllFile)
	entries := make([]Entry, len(paths))
	for i, p := range paths {
		entries[i].Path = p
		entries[i].Data, entries[i].Error = w.json(p)
	}
	return entries
}

// SavePlace saves place as <folder>/places/<id>.json, new or replacing the
// one there, in the pending changes. It fails when another place has the same
// name, ignoring case.
func (c *Client) SavePlace(ctx context.Context, gh settings.GitHub, place Place) (EntryResult, error) {
	place, perr := validPlace(place)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, Places, place.ID, place, func(others []Entry) *PublishError {
		if perr := placeNameTaken(others, place); perr != nil {
			return perr
		}
		return badParent(others, place)
	})
}

// SaveLocalization saves localization as <folder>/localizations/<id>.json,
// new or replacing the one there, as SavePlace does. It fails when one of its
// other names is another country's or city's, or it's another's other name.
func (c *Client) SaveLocalization(ctx context.Context, gh settings.GitHub, localization Localization) (EntryResult, error) {
	localization, perr := validLocalization(localization)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, Localizations, localization.ID, localization, func(others []Entry) *PublishError {
		return otherNamesTaken(others, localization)
	})
}

// saveEntry saves content as kind's file named id in the pending changes,
// after check passes on the kind's other files.
func (c *Client) saveEntry(ctx context.Context, gh settings.GitHub, kind EntryKind, id string, content any, check func(others []Entry) *PublishError) (EntryResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	file := w.root + "/" + kind.Folder + "/" + id + ".json"
	before, others := splitEntry(w.entries(kind), file)
	if perr := check(others); perr != nil {
		return EntryResult{}, perr
	}
	b, err := json.MarshalIndent(content, "", "  ")
	if err != nil {
		return EntryResult{}, publishErr(http.StatusInternalServerError, "Couldn't encode the %s.", kind.Name)
	}
	b = append(b, '\n')
	result := EntryResult{Path: file, Data: b, Before: before, pendingSave: w.pendingSave(nil)}
	if bytes.Equal(before, b) {
		return result, nil
	}
	if result.pendingSave, perr = c.saveFiles(w, []ScanChange{{Path: file, Before: before, After: b}}); perr != nil {
		return EntryResult{}, perr
	}
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

// badParent fails when place's parent isn't another place in others, or
// when place is already above its parent, which would make a loop.
func badParent(others []Entry, place Place) *PublishError {
	if place.Parent == "" {
		return nil
	}
	parents := map[string]string{}
	for _, e := range others {
		var other Place
		if json.Unmarshal(e.Data, &other) == nil {
			parents[other.ID] = other.Parent
		}
	}
	if _, ok := parents[place.Parent]; !ok {
		return publishErr(http.StatusBadRequest, "There's no place with the ID %q to put this one in.", place.Parent)
	}
	// Walks up from the parent; reaching place means place is above its own parent.
	for id, seen := place.Parent, 0; id != "" && seen <= len(parents); id, seen = parents[id], seen+1 {
		if id == place.ID {
			return publishErr(http.StatusBadRequest, "A place can't be in itself or in a place that's in it.")
		}
	}
	return nil
}

// badCoordinates fails when the place has only one of latitude and longitude,
// or either is off the globe.
func badCoordinates(p Place) *PublishError {
	if (p.Latitude == nil) != (p.Longitude == nil) {
		return publishErr(http.StatusBadRequest, "Give both a latitude and a longitude, or neither.")
	}
	if p.Latitude == nil {
		return nil
	}
	if math.Abs(*p.Latitude) > 90 || math.Abs(*p.Longitude) > 180 {
		return publishErr(http.StatusBadRequest, "The latitude must be between -90 and 90, and the longitude between -180 and 180.")
	}
	return nil
}

// validPlace checks place and returns it trimmed, as it will be saved.
func validPlace(place Place) (Place, *PublishError) {
	p := Place{
		ID: strings.TrimSpace(place.ID), Name: strings.TrimSpace(place.Name), Description: strings.TrimSpace(place.Description),
		Parent: strings.TrimSpace(place.Parent), City: strings.TrimSpace(place.City), Country: strings.TrimSpace(place.Country),
		Latitude: place.Latitude, Longitude: place.Longitude,
		ExactLocation: place.ExactLocation && place.Latitude != nil,
		ChildRelation: strings.TrimSpace(place.ChildRelation),
	}
	if p.Parent != "" {
		p.ParentRelation = strings.TrimSpace(place.ParentRelation)
	}
	if perr := badRelations(p); perr != nil {
		return p, perr
	}
	if perr := badCoordinates(p); perr != nil {
		return p, perr
	}
	if perr := validEntryID("place", p.ID); perr != nil {
		return p, perr
	}
	if p.Parent != "" {
		if perr := validEntryID("parent place", p.Parent); perr != nil {
			return p, perr
		}
	}
	if utf8.RuneCountInString(p.City) > maxGroupNameLength || utf8.RuneCountInString(p.Country) > maxGroupNameLength {
		return p, publishErr(http.StatusBadRequest, "Keep the city and country to %d characters each.", maxGroupNameLength)
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

// badRelations fails unless p's ParentRelation and ChildRelation are each
// "" or one of placeRelations.
func badRelations(p Place) *PublishError {
	for _, r := range []string{p.ParentRelation, p.ChildRelation} {
		if r != "" && !slices.Contains(placeRelations, r) {
			return publishErr(http.StatusBadRequest, "A place's connecting word is one of %s.", strings.Join(placeRelations, ", "))
		}
	}
	return nil
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
	var perr *PublishError
	out.OtherNames, perr = cleanOtherNames(out, l.OtherNames)
	return out, perr
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
