package github

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strings"
	"sync"
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
	Parent  string `json:"parent,omitempty"`
	Path    string `json:"path"`
	FileURL string `json:"fileUrl"`
	// InFlight is true when the file is only on the photo data pull
	// request's branch, not merged yet.
	InFlight bool `json:"inFlight"`
	// Error says why the file couldn't be read; ID is then its file name.
	Error string `json:"error,omitempty"`
}

// OrganizeResult is every album and tag on the base branch and the open
// photo data pull request.
type OrganizeResult struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	Branch string `json:"branch"`
	// PullRequest is nil when no photo data pull request is open.
	PullRequest *InFlightPullRequest `json:"pullRequest"`
	Albums      []Group              `json:"albums"`
	Tags        []Group              `json:"tags"`
}

// Organize lists the albums and tags on the base branch from Settings (or
// the default branch) and on the open photo data pull request's branch,
// sorted by name. It only reads from GitHub.
func (c *Client) Organize(ctx context.Context, gh settings.GitHub) (OrganizeResult, error) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return OrganizeResult{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return OrganizeResult{}, perr
	}
	open, perr := c.findPullRequest(ctx, t)
	if perr != nil {
		return OrganizeResult{}, perr
	}
	result := OrganizeResult{Repo: t.repo.FullName, Folder: root, Branch: t.base}
	if open != nil {
		result.PullRequest = &InFlightPullRequest{Number: open.Number, URL: open.HTMLURL, Branch: open.Head.Ref, Title: PullRequestTitle}
	}
	groups, perr := c.readGroups(ctx, t, root, open)
	if perr != nil {
		return OrganizeResult{}, perr
	}
	result.Albums, result.Tags = groups[Albums.Folder], groups[Tags.Folder]
	return result, nil
}

// CreateGroup saves group as a new kind file, <folder>/<kind folder>/<id>.json,
// in the open photo data pull request, or a new one, as Publish does. It fails
// when an album or tag already has the same ID or name, ignoring case, on the
// base branch or the pull request's branch.
func (c *Client) CreateGroup(ctx context.Context, gh settings.GitHub, kind Kind, group NewGroup) (PublishResult, error) {
	content, perr := validGroup(kind, group)
	if perr != nil {
		return PublishResult{}, perr
	}
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return PublishResult{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return PublishResult{}, perr
	}
	open, perr := c.findPullRequest(ctx, t)
	if perr != nil {
		return PublishResult{}, perr
	}
	groups, perr := c.readGroups(ctx, t, root, open)
	if perr != nil {
		return PublishResult{}, perr
	}
	if perr := checkCollision(groups, group); perr != nil {
		return PublishResult{}, perr
	}
	if content.Parent != nil {
		if perr := checkParent(groups[Albums.Folder], content.ID, *content.Parent); perr != nil {
			return PublishResult{}, perr
		}
	}
	file := root + "/" + kind.Folder + "/" + content.ID + ".json"
	b, err := json.MarshalIndent(fileContent(kind, content), "", "  ")
	if err != nil {
		return PublishResult{}, publishErr(http.StatusInternalServerError, "Couldn't encode the %s.", kind.Name)
	}
	return c.saveNewFile(ctx, t, open, file, append(b, '\n'), "Add "+kind.Name+" "+file)
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

// AlbumParentResult says where an album's new parent was committed.
type AlbumParentResult struct {
	scanCommit
	Path    string `json:"path"`
	FileURL string `json:"fileUrl"`
	// Changed is false when the album already had that parent, so nothing
	// was committed.
	Changed bool `json:"changed"`
}

// SetAlbumParent makes parent, an album ID, the parent of the album id, or
// makes it a top-level album when parent is empty, as one commit on the open
// photo data pull request's branch, or a new one with its pull request. Only
// the file's "parent" changes. It fails when that would make an album its own
// ancestor.
func (c *Client) SetAlbumParent(ctx context.Context, gh settings.GitHub, id, parent string) (AlbumParentResult, error) {
	id, parent = strings.TrimSpace(id), strings.TrimSpace(parent)
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return AlbumParentResult{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return AlbumParentResult{}, perr
	}
	scan := baseURLScan{t: t, branch: t.base}
	if scan.pr, perr = c.findPullRequest(ctx, t); perr != nil {
		return AlbumParentResult{}, perr
	}
	if scan.pr != nil {
		scan.branch = scan.pr.Head.Ref
	}
	groups, perr := c.readGroups(ctx, t, root, scan.pr)
	if perr != nil {
		return AlbumParentResult{}, perr
	}
	album, ok := findGroup(groups[Albums.Folder], id)
	if !ok {
		return AlbumParentResult{}, publishErr(http.StatusNotFound, "There's no album with the ID %q. Refresh to see what there is.", id)
	}
	if album.Error != "" {
		return AlbumParentResult{}, publishErr(http.StatusConflict, "%s couldn't be read (%s), so it wasn't changed.", album.Path, album.Error)
	}
	value := []byte("null")
	if parent != "" {
		if perr := checkParent(groups[Albums.Folder], id, parent); perr != nil {
			return AlbumParentResult{}, perr
		}
		value, _ = json.Marshal(parent)
	}
	if scan.headSHA, perr = c.branchHead(ctx, t, scan.branch); perr != nil {
		return AlbumParentResult{}, perr
	}
	current, _, found, msg := c.readFileSHA(ctx, t, album.Path, scan.headSHA)
	if !found {
		return AlbumParentResult{}, publishErr(http.StatusConflict, "%s isn't on %s. Refresh and try again.", album.Path, scan.branch)
	}
	if msg != "" {
		return AlbumParentResult{}, publishErr(http.StatusBadGateway, "%s", msg)
	}
	content, err := setTopLevel(current, parentKey, value)
	if err != nil {
		return AlbumParentResult{}, publishErr(http.StatusConflict, "%s: %s", album.Path, err)
	}
	result := AlbumParentResult{Path: album.Path, FileURL: album.FileURL}
	if bytes.Equal(content, current) {
		return result, nil
	}
	entries := []map[string]string{{"path": album.Path, "mode": "100644", "type": "blob", "content": string(content)}}
	message := "Move album " + album.Path + " to the top level"
	if parent != "" {
		message = "Move album " + album.Path + " into " + parent
	}
	saved, perr := c.commitScan(ctx, scan, entries, message)
	if perr != nil {
		return AlbumParentResult{}, perr
	}
	result.scanCommit, result.Changed = saved, true
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

// readGroups reads every album and tag file on the base branch and, when
// open isn't nil, on its branch, keyed by kind folder and sorted by name.
func (c *Client) readGroups(ctx context.Context, t target, root string, open *pullRequest) (map[string][]Group, *PublishError) {
	type listed struct {
		entry folderEntry
		ref   string
		group *Group
	}
	var all []listed
	byKind := map[string][]int{}
	for _, k := range kinds {
		folder := root + "/" + k.Folder
		onBase, perr := c.listJSON(ctx, t, folder, t.base, k.AllFile)
		if perr != nil {
			return nil, perr
		}
		seen := map[string]bool{}
		var onBranch []folderEntry
		if open != nil {
			if onBranch, perr = c.listJSON(ctx, t, folder, open.Head.Ref, k.AllFile); perr != nil {
				return nil, perr
			}
		}
		for _, e := range onBase {
			seen[e.Path] = true
		}
		// The pull request's copy is read when there is one, since it may be newer.
		ref := t.base
		if open != nil {
			ref = open.Head.Ref
		}
		branchPaths := map[string]bool{}
		for _, e := range onBranch {
			branchPaths[e.Path] = true
			byKind[k.Folder] = append(byKind[k.Folder], len(all))
			all = append(all, listed{entry: e, ref: ref, group: &Group{InFlight: !seen[e.Path]}})
		}
		for _, e := range onBase {
			if branchPaths[e.Path] {
				continue
			}
			byKind[k.Folder] = append(byKind[k.Folder], len(all))
			all = append(all, listed{entry: e, ref: t.base, group: &Group{}})
		}
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, readConcurrency)
	for _, l := range all {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			c.readGroup(ctx, t, l.entry, l.ref, l.group)
		}()
	}
	wg.Wait()

	out := map[string][]Group{}
	for _, k := range kinds {
		groups := []Group{}
		for _, i := range byKind[k.Folder] {
			groups = append(groups, *all[i].group)
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
	return out, nil
}

// readGroup fills g from the file e at ref.
func (c *Client) readGroup(ctx context.Context, t target, e folderEntry, ref string, g *Group) {
	g.Path, g.FileURL = e.Path, e.HTMLURL
	g.ID = strings.TrimSuffix(e.Name, path.Ext(e.Name))
	data, msg := c.readJSON(ctx, t, e.Path, ref)
	if msg != "" {
		g.Error = msg
		return
	}
	var content groupJSON
	if json.Unmarshal(data, &content) != nil {
		g.Error = "The file isn't a JSON object."
		return
	}
	if id := strings.TrimSpace(content.ID); id != "" {
		g.ID = id
	}
	g.Name, g.Description = strings.TrimSpace(content.Name), strings.TrimSpace(content.Description)
	if content.Parent != nil {
		g.Parent = strings.TrimSpace(*content.Parent)
	}
}

// listJSON lists the .json files directly in folder at ref, except skip, or
// none when the folder isn't there.
func (c *Client) listJSON(ctx context.Context, t target, folder, ref, skip string) ([]folderEntry, *PublishError) {
	var entries []folderEntry
	p := repoPath(t.owner, t.name) + "/contents/" + escapePath(folder) + "?ref=" + url.QueryEscape(ref)
	res, err := c.do(ctx, http.MethodGet, p, t.token, nil, &entries)
	if err == nil && res.Status == http.StatusNotFound {
		return nil, nil
	}
	if perr := readCheck(res, err, "listing "+folder); perr != nil {
		return nil, perr
	}
	var files []folderEntry
	for _, e := range entries {
		if e.Type == "file" && strings.EqualFold(path.Ext(e.Name), ".json") && !strings.EqualFold(e.Name, skip) {
			files = append(files, e)
		}
	}
	return files, nil
}
