package github

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
)

// snapshot is every file directly in the data folder's subfolders (photos,
// albums, tags, places and localizations) at one commit. A commit never
// changes, so a snapshot is read from GitHub once, with one GraphQL query, and
// kept.
type snapshot struct {
	commit string
	// tree is the commit's tree, which a new commit's tree is made on.
	tree  string
	files map[string]snapFile
}

// snapFile is one file in a snapshot.
type snapFile struct {
	// sha is the file's Git blob SHA.
	sha     string
	content []byte
	// err says why the content couldn't be read, when it couldn't.
	err string
}

// snapshotQuery reads the commit's tree and each data subfolder's files with
// their content. Each folder is an expression such as "<sha>:<folder>".
const snapshotQuery = `query($owner: String!, $name: String!, $commit: String!, $photos: String!, $albums: String!,
  $tags: String!, $places: String!, $localizations: String!) {
  repository(owner: $owner, name: $name) {
    commit: object(expression: $commit) { ... on Commit { tree { oid } } }
    photos: object(expression: $photos) { ...files }
    albums: object(expression: $albums) { ...files }
    tags: object(expression: $tags) { ...files }
    places: object(expression: $places) { ...files }
    localizations: object(expression: $localizations) { ...files }
  }
}
fragment files on Tree { entries { name type oid object { ... on Blob { text isTruncated isBinary } } } }`

// treeAnswer is a folder in snapshotQuery's answer; nil when the folder isn't
// there.
type treeAnswer *struct {
	Entries []struct {
		Name   string `json:"name"`
		Type   string `json:"type"`
		OID    string `json:"oid"`
		Object struct {
			Text        *string `json:"text"`
			IsTruncated bool    `json:"isTruncated"`
			IsBinary    bool    `json:"isBinary"`
		} `json:"object"`
	} `json:"entries"`
}

// snapshotAnswer is the data of snapshotQuery.
type snapshotAnswer struct {
	Repository *struct {
		Commit *struct {
			Tree gitObject `json:"tree"`
		} `json:"commit"`
		Photos        treeAnswer `json:"photos"`
		Albums        treeAnswer `json:"albums"`
		Tags          treeAnswer `json:"tags"`
		Places        treeAnswer `json:"places"`
		Localizations treeAnswer `json:"localizations"`
	} `json:"repository"`
}

// folders pairs each folder's answer with the kind it's of.
func (a snapshotAnswer) folders() map[string]treeAnswer {
	r := a.Repository
	return map[string]treeAnswer{
		PhotosFolder: r.Photos, Albums.Folder: r.Albums, Tags.Folder: r.Tags,
		Places.Folder: r.Places, Localizations.Folder: r.Localizations,
	}
}

// snapshot returns the data folder root at commit: from this run's reads, or
// the local copy, or else read from GitHub once and kept in both.
func (c *Client) snapshot(ctx context.Context, t target, root, commit string) (*snapshot, *PublishError) {
	key := snapshotKey(t, root, commit)
	if s, ok := c.reads().snapshot(key); ok {
		return s, nil
	}
	if s, ok := c.localCopy().snapshot(key); ok {
		c.reads().setSnapshot(key, s)
		return s, nil
	}
	vars := map[string]any{"owner": t.owner, "name": t.name, "commit": commit}
	for _, k := range combinedKinds() {
		vars[k.name] = commit + ":" + root + "/" + k.folder
	}
	var answer snapshotAnswer
	if perr := c.graphql(ctx, t, snapshotQuery, vars, &answer, "reading the photo data"); perr != nil {
		return nil, perr
	}
	if answer.Repository == nil || answer.Repository.Commit == nil {
		return nil, publishErr(http.StatusBadGateway, "Commit %s wasn't found in %s.", commit, t.repo.FullName)
	}
	s := &snapshot{commit: commit, tree: answer.Repository.Commit.Tree.OID, files: map[string]snapFile{}}
	for folder, tree := range answer.folders() {
		c.addFolder(ctx, t, s, root+"/"+folder, tree)
	}
	c.keepSnapshot(key, s)
	return s, nil
}

// keepSnapshot keeps s for the rest of the run and in the local copy.
func (c *Client) keepSnapshot(key string, s *snapshot) {
	r := c.reads()
	r.setSnapshot(key, s)
	c.localCopy().saveSnapshots(r.allSnapshots())
}

// snapshotKey is what the snapshot of root at commit in t's repository is
// kept by.
func snapshotKey(t target, root, commit string) string {
	return repoKey(t) + "\x00" + root + "\x00" + commit
}

// addFolder adds the files of tree, the folder at folder, to s. A file
// GraphQL didn't give the text of, such as a large combined list, is read
// from its blob.
func (c *Client) addFolder(ctx context.Context, t target, s *snapshot, folder string, tree treeAnswer) {
	if tree == nil {
		return
	}
	for _, e := range tree.Entries {
		if e.Type != "blob" {
			continue
		}
		f := snapFile{sha: e.OID}
		switch {
		case e.Object.IsBinary:
			f.err = "The file isn't text."
		case e.Object.Text == nil || e.Object.IsTruncated:
			f.content, f.err = c.readBlobContent(ctx, t, e.OID)
		default:
			f.content = []byte(*e.Object.Text)
		}
		s.files[folder+"/"+e.Name] = f
	}
}

// readBlobContent reads the blob sha, or says why it couldn't.
func (c *Client) readBlobContent(ctx context.Context, t target, sha string) ([]byte, string) {
	var blob struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/git/blobs/"+url.PathEscape(sha), t.token, nil, &blob)
	if perr := readCheck(res, err, "reading the file"); perr != nil {
		return nil, perr.Message
	}
	content, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(blob.Content, "\n", ""))
	if blob.Encoding != "base64" || err != nil {
		return nil, "GitHub returned content that couldn't be decoded."
	}
	return content, ""
}

// withChanges is s after a commit that wrote changes (nil content deletes),
// so the commit's snapshot needs no read.
func (s *snapshot) withChanges(commit, tree string, changes map[string][]byte) *snapshot {
	out := &snapshot{commit: commit, tree: tree, files: make(map[string]snapFile, len(s.files))}
	for p, f := range s.files {
		out.files[p] = f
	}
	for p, content := range changes {
		if content == nil {
			delete(out.files, p)
			continue
		}
		out.files[p] = snapFile{sha: blobSHA(content), content: content}
	}
	return out
}

// maxSnapshots is how many snapshots are kept: enough for the base branch
// and a few pull request heads.
const maxSnapshots = 6

// readCache keeps this run's reads: repoStates until Commit or a Refresh
// changes them, and snapshots for good.
type readCache struct {
	mu        sync.Mutex
	states    map[string]repoState
	snapshots map[string]*snapshot
	// order is the snapshots' keys, oldest first.
	order []string
}

func (c *Client) reads() *readCache {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cache == nil {
		c.cache = &readCache{states: map[string]repoState{}, snapshots: map[string]*snapshot{}}
	}
	return c.cache
}

func (r *readCache) state(key string) (repoState, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.states[key]
	return s, ok
}

func (r *readCache) setState(key string, s repoState) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.states[key] = s
}

// forget drops the state kept by key, so the next read asks GitHub.
func (r *readCache) forget(key string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.states, key)
}

// allSnapshots is a copy of the snapshots kept.
func (r *readCache) allSnapshots() map[string]*snapshot {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make(map[string]*snapshot, len(r.snapshots))
	for k, s := range r.snapshots {
		out[k] = s
	}
	return out
}

func (r *readCache) snapshot(key string) (*snapshot, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.snapshots[key]
	return s, ok
}

func (r *readCache) setSnapshot(key string, s *snapshot) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.snapshots[key]; !ok {
		r.order = append(r.order, key)
	}
	r.snapshots[key] = s
	for len(r.order) > maxSnapshots {
		delete(r.snapshots, r.order[0])
		r.order = r.order[1:]
	}
}

// inFolder reports a file directly in folder.
func inFolder(folder, file string) bool {
	return path.Dir(file) == folder
}
