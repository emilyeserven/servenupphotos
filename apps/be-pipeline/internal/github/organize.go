package github

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"path"
	"regexp"
	"slices"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// Kind is a way of organizing photos: albums or tags. Each album or tag is
// one JSON file in its kind's folder, named by its ID, and CI combines them
// into the kind's AllFile. A photo lists the IDs of its albums and tags in
// its "albums" and "tags" keys. An album may have one parent album, by ID.
type Kind struct {
	// Name is the kind's singular name, as shown: "album" or "tag".
	Name string
	// Folder is the data folder's subfolder of the kind's files.
	Folder string
	// AllFile is the combined list of the kind's files, rebuilt by CI.
	AllFile string
}

// The kinds, which share one namespace of IDs and names so a photo's albums
// and tags never collide.
var (
	Albums = Kind{Name: "album", Folder: "albums", AllFile: "ALLALBUMS.json"}
	Tags   = Kind{Name: "tag", Folder: "tags", AllFile: "ALLTAGS.json"}
	kinds  = []Kind{Albums, Tags}
)

// KindByFolder returns the kind whose folder is folder, such as "albums".
func KindByFolder(folder string) (Kind, bool) {
	for _, k := range kinds {
		if k.Folder == folder {
			return k, true
		}
	}
	return Kind{}, false
}

// groupIDPattern is an album or tag ID: lowercase letters, numbers and
// single dashes, which is also its file name.
var groupIDPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

const (
	maxGroupIDLength          = 100
	maxGroupNameLength        = 100
	maxGroupDescriptionLength = 1000
)

// NewGroup is an album or tag to create.
type NewGroup struct {
	// ID is its file name and what photos list it by.
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// Parent is the ID of an album's parent album, or empty for none. Tags
	// have no parent.
	Parent string `json:"parent,omitempty"`
}

// groupJSON is the content of an album or tag file, as read.
type groupJSON struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Parent      *string `json:"parent,omitempty"`
}

// albumJSON is the content of an album file, as written: it always lists its
// parent, null for a top-level album.
type albumJSON struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Parent      *string `json:"parent"`
}

// fileContent is g as kind's files are written.
func fileContent(kind Kind, g groupJSON) any {
	if kind == Albums {
		return albumJSON(g)
	}
	return g
}

// Group is one album or tag file.
type Group struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	// Parent is an album's parent album's ID, empty for a top-level album.
	Parent string `json:"parent,omitempty"`
	Path   string `json:"path"`
	// FileURL is the file's page on GitHub; empty while its latest change is
	// only pending.
	FileURL string `json:"fileUrl"`
	// InFlight is true when the file isn't on the base branch yet: it's on
	// the photo data pull request's branch, or only pending.
	InFlight bool `json:"inFlight"`
	// Error says why the file couldn't be read; ID is then its file name.
	Error string `json:"error,omitempty"`
}

// OrganizeResult is every album and tag on the base branch and in flight.
type OrganizeResult struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	Branch string `json:"branch"`
	// PullRequest is nil when no photo data pull request is open.
	PullRequest *InFlightPullRequest `json:"pullRequest"`
	Albums      []Group              `json:"albums"`
	Tags        []Group              `json:"tags"`
}

// Organize lists the albums and tags as the next Commit will have them, with
// the ones only on the base branch, sorted by name.
func (c *Client) Organize(ctx context.Context, gh settings.GitHub) (OrganizeResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return OrganizeResult{}, perr
	}
	result := OrganizeResult{Repo: w.t.repo.FullName, Folder: w.root, Branch: w.t.base, PullRequest: w.inFlightPullRequest()}
	groups := w.groups()
	result.Albums, result.Tags = groups[Albums.Folder], groups[Tags.Folder]
	return result, nil
}

// CreateGroup saves group as a new kind file, <folder>/<kind folder>/<id>.json,
// in the pending changes, as Publish does. It fails when an album or tag
// already has the same ID or name, ignoring case.
func (c *Client) CreateGroup(ctx context.Context, gh settings.GitHub, kind Kind, group NewGroup) (PublishResult, error) {
	content, perr := validGroup(kind, group)
	if perr != nil {
		return PublishResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return PublishResult{}, perr
	}
	groups := w.groups()
	if perr := checkCollision(groups, group); perr != nil {
		return PublishResult{}, perr
	}
	if content.Parent != nil {
		if perr := checkParent(groups[Albums.Folder], content.ID, *content.Parent); perr != nil {
			return PublishResult{}, perr
		}
	}
	file := w.root + "/" + kind.Folder + "/" + content.ID + ".json"
	b, err := json.MarshalIndent(fileContent(kind, content), "", "  ")
	if err != nil {
		return PublishResult{}, publishErr(http.StatusInternalServerError, "Couldn't encode the %s.", kind.Name)
	}
	return c.saveNewFile(w, file, append(b, '\n'))
}

// validGroup checks group and returns it trimmed, as it will be saved.
func validGroup(kind Kind, group NewGroup) (groupJSON, *PublishError) {
	g := groupJSON{
		ID:          strings.TrimSpace(group.ID),
		Name:        strings.TrimSpace(group.Name),
		Description: strings.TrimSpace(group.Description),
	}
	switch {
	case g.Name == "":
		return g, publishErr(http.StatusBadRequest, "Give the %s a name.", kind.Name)
	case utf8.RuneCountInString(g.Name) > maxGroupNameLength:
		return g, publishErr(http.StatusBadRequest, "Keep the name to %d characters.", maxGroupNameLength)
	case len(g.ID) > maxGroupIDLength || !groupIDPattern.MatchString(g.ID):
		return g, publishErr(http.StatusBadRequest,
			"Use an ID of up to %d lowercase letters and numbers, with single dashes between words.", maxGroupIDLength)
	case utf8.RuneCountInString(g.Description) > maxGroupDescriptionLength:
		return g, publishErr(http.StatusBadRequest, "Keep the description to %d characters.", maxGroupDescriptionLength)
	}
	if parent := strings.TrimSpace(group.Parent); parent != "" {
		if kind != Albums {
			return g, publishErr(http.StatusBadRequest, "Only albums can have a parent.")
		}
		g.Parent = &parent
	}
	return g, nil
}

// checkParent fails unless parent is one of albums and making it id's parent
// leaves no album its own ancestor.
func checkParent(albums []Group, id, parent string) *PublishError {
	parents := map[string]string{}
	names := map[string]string{}
	for _, a := range albums {
		parents[a.ID], names[a.ID] = a.Parent, a.Name
	}
	if _, ok := parents[parent]; !ok {
		return publishErr(http.StatusBadRequest, "There's no album with the ID %q to be the parent.", parent)
	}
	parents[id] = parent
	seen := map[string]bool{}
	for at := id; at != ""; at = parents[at] {
		if seen[at] {
			return publishErr(http.StatusConflict,
				"%q is inside %q already, so it can't be its parent.", cmp.Or(names[parent], parent), cmp.Or(names[id], id))
		}
		seen[at] = true
	}
	return nil
}

// AlbumParentResult says where an album's new parent was saved.
type AlbumParentResult struct {
	pendingSave
	Path string `json:"path"`
	// Changed is false when the album already had that parent, so nothing
	// was saved.
	Changed bool `json:"changed"`
}

// SetAlbumParent makes parent, an album ID, the parent of the album id, or
// makes it a top-level album when parent is empty, in the pending changes.
// Only the file's "parent" changes. It fails when that would make an album
// its own ancestor.
func (c *Client) SetAlbumParent(ctx context.Context, gh settings.GitHub, id, parent string) (AlbumParentResult, error) {
	id, parent = strings.TrimSpace(id), strings.TrimSpace(parent)
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumParentResult{}, perr
	}
	albums := w.groups()[Albums.Folder]
	album, ok := findGroup(albums, id)
	if !ok {
		return AlbumParentResult{}, publishErr(http.StatusNotFound, "There's no album with the ID %q. Refresh to see what there is.", id)
	}
	if album.Error != "" {
		return AlbumParentResult{}, publishErr(http.StatusConflict, "%s couldn't be read (%s), so it wasn't changed.", album.Path, album.Error)
	}
	value := []byte("null")
	if parent != "" {
		if perr := checkParent(albums, id, parent); perr != nil {
			return AlbumParentResult{}, perr
		}
		value, _ = json.Marshal(parent)
	}
	current, _ := w.groupFile(album.Path)
	content, err := setTopLevel(current, parentKey, value)
	if err != nil {
		return AlbumParentResult{}, publishErr(http.StatusConflict, "%s: %s", album.Path, err)
	}
	result := AlbumParentResult{Path: album.Path, pendingSave: w.pendingSave(nil)}
	if bytes.Equal(content, current) {
		return result, nil
	}
	if result.pendingSave, perr = c.saveFiles(w, []ScanChange{{Path: album.Path, Before: current, After: content}}); perr != nil {
		return AlbumParentResult{}, perr
	}
	result.Changed = true
	return result, nil
}

// parentKey is the album file field that holds its parent's ID.
const parentKey = "parent"

// findGroup returns the album or tag in groups with id.
func findGroup(groups []Group, id string) (Group, bool) {
	for _, g := range groups {
		if g.ID == id {
			return g, true
		}
	}
	return Group{}, false
}

// checkCollision fails when an album or tag in groups has group's ID or name,
// ignoring case and surrounding spaces.
func checkCollision(groups map[string][]Group, group NewGroup) *PublishError {
	id, name := strings.TrimSpace(group.ID), strings.TrimSpace(group.Name)
	for _, k := range kinds {
		for _, g := range groups[k.Folder] {
			switch {
			case strings.EqualFold(g.ID, id):
				return publishErr(http.StatusConflict, "The %s %q already has the ID %q. Pick another ID.", k.Name, g.Name, g.ID)
			case g.Name != "" && strings.EqualFold(strings.TrimSpace(g.Name), name):
				return publishErr(http.StatusConflict, "There's already a %s named %q. Pick another name.", k.Name, g.Name)
			}
		}
	}
	return nil
}

// groups is every album and tag file as the next Commit will have it, and
// the ones only on the base branch, keyed by kind folder and sorted by name.
func (w *workspace) groups() map[string][]Group {
	out := map[string][]Group{}
	for _, k := range kinds {
		folder := w.root + "/" + k.Folder
		paths := w.paths(folder, k.AllFile)
		for _, p := range w.basePaths(folder, k.AllFile) {
			if _, staged := w.staged[p]; !staged && !slices.Contains(paths, p) {
				paths = append(paths, p)
			}
		}
		groups := make([]Group, 0, len(paths))
		for _, p := range paths {
			groups = append(groups, w.readGroup(p))
		}
		sort.Slice(groups, func(i, j int) bool {
			a, b := strings.ToLower(groups[i].Name), strings.ToLower(groups[j].Name)
			if a != b {
				return a < b
			}
			return groups[i].ID < groups[j].ID
		})
		out[k.Folder] = groups
	}
	return out
}

// groupFile is p's content as the next Commit will have it, or as the base
// branch has it when it's only there, or why it couldn't be read.
func (w *workspace) groupFile(p string) ([]byte, string) {
	if _, ok := w.file(p); ok {
		data, msg := w.json(p)
		return data, msg
	}
	f := w.base.files[p]
	if f.err == "" && !json.Valid(f.content) {
		return nil, "The file isn't valid JSON."
	}
	return f.content, f.err
}

// readGroup is the album or tag file at p.
func (w *workspace) readGroup(p string) Group {
	g := Group{Path: p, FileURL: w.fileURL(p), InFlight: !w.onBase(p)}
	if _, ok := w.file(p); !ok {
		g.FileURL = blobURL(w.t, w.t.base, p)
	}
	g.ID = strings.TrimSuffix(path.Base(p), path.Ext(p))
	data, msg := w.groupFile(p)
	if msg != "" {
		g.Error = msg
		return g
	}
	var content groupJSON
	if json.Unmarshal(data, &content) != nil {
		g.Error = "The file isn't a JSON object."
		return g
	}
	if id := strings.TrimSpace(content.ID); id != "" {
		g.ID = id
	}
	g.Name, g.Description = strings.TrimSpace(content.Name), strings.TrimSpace(content.Description)
	if content.Parent != nil {
		g.Parent = strings.TrimSpace(*content.Parent)
	}
	return g
}
