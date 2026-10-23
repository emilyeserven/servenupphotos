package github

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"strings"
	"sync"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// LocalCopy is the photo data last read from GitHub, kept in a JSON file
// next to the settings: where each repository stood (its base branch's head
// and the open photo data pull request) and the snapshots read at those
// commits. The pipeline reads GitHub once when it starts, and only reads a
// snapshot it doesn't have here; when GitHub can't be reached then, as when
// the rate limit is spent, it works from this copy instead. It holds no
// token.
type LocalCopy struct {
	path   string
	mu     sync.Mutex
	loaded bool
	file   localFile
}

// NewLocalCopy keeps the local copy at path; "" keeps nothing.
func NewLocalCopy(path string) *LocalCopy {
	return &LocalCopy{path: path}
}

// localFile is the local copy's JSON.
type localFile struct {
	// States are by localKey.
	States    map[string]savedState    `json:"states"`
	Snapshots map[string]savedSnapshot `json:"snapshots"`
}

// savedState is a repoState without its token.
type savedState struct {
	FullName      string        `json:"fullName"`
	DefaultBranch string        `json:"defaultBranch"`
	Base          string        `json:"base"`
	BaseHead      string        `json:"baseHead"`
	PR            *inFlightPull `json:"pullRequest"`
}

// savedSnapshot is a snapshot, with each file's content as text.
type savedSnapshot struct {
	Commit string               `json:"commit"`
	Tree   string               `json:"tree"`
	Files  map[string]savedFile `json:"files"`
}

type savedFile struct {
	SHA     string `json:"sha"`
	Content string `json:"content,omitempty"`
	Err     string `json:"error,omitempty"`
}

// localKey is what gh's repository's state is kept by in the local copy: its
// repository and branch, hashed, without the token.
func localKey(gh settings.GitHub) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(gh.Repo) + "\x00" + strings.TrimSpace(gh.Branch)))
	return hex.EncodeToString(sum[:])
}

// load reads the file once; a missing or unreadable one is an empty copy.
func (l *LocalCopy) load() {
	if l.loaded {
		return
	}
	l.loaded = true
	l.file = localFile{States: map[string]savedState{}, Snapshots: map[string]savedSnapshot{}}
	if l.path == "" {
		return
	}
	b, err := os.ReadFile(l.path)
	if errors.Is(err, fs.ErrNotExist) {
		return
	}
	var file localFile
	if err == nil {
		err = json.Unmarshal(b, &file)
	}
	if err != nil {
		slog.Warn("local copy of the photo data unreadable, starting empty", "err", err)
		return
	}
	if file.States != nil {
		l.file.States = file.States
	}
	if file.Snapshots != nil {
		l.file.Snapshots = file.Snapshots
	}
}

// state is gh's repository's state as last read, with gh's token, and false
// when the copy has none.
func (l *LocalCopy) state(gh settings.GitHub, key string) (repoState, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.load()
	saved, ok := l.file.States[localKey(gh)]
	if !ok {
		return repoState{}, false
	}
	owner, name, _ := splitRepo(gh.Repo)
	t := target{owner: owner, name: name, token: gh.Token, base: saved.Base}
	t.repo = repoInfo{FullName: saved.FullName, DefaultBranch: saved.DefaultBranch}
	return repoState{t: t, baseHead: saved.BaseHead, pr: saved.PR, key: key, local: localKey(gh)}, true
}

// snapshot is the snapshot kept by key, and false when the copy has none.
func (l *LocalCopy) snapshot(key string) (*snapshot, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.load()
	saved, ok := l.file.Snapshots[key]
	if !ok {
		return nil, false
	}
	s := &snapshot{commit: saved.Commit, tree: saved.Tree, files: make(map[string]snapFile, len(saved.Files))}
	for p, f := range saved.Files {
		s.files[p] = snapFile{sha: f.SHA, content: []byte(f.Content), err: f.Err}
	}
	return s, true
}

// saveState keeps state, by its local key.
func (l *LocalCopy) saveState(state repoState) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.load()
	l.file.States[state.local] = savedState{
		FullName: state.t.repo.FullName, DefaultBranch: state.t.repo.DefaultBranch, Base: state.t.base,
		BaseHead: state.baseHead, PR: state.pr,
	}
	l.write()
}

// saveSnapshots keeps the snapshots read this run, replacing the ones kept
// before, so the file holds what the pipeline last used.
func (l *LocalCopy) saveSnapshots(snapshots map[string]*snapshot) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.load()
	l.file.Snapshots = make(map[string]savedSnapshot, len(snapshots))
	for key, s := range snapshots {
		l.file.Snapshots[key] = savedOf(s)
	}
	l.write()
}

// write writes the copy to its file; failing only costs the next start a
// read from GitHub, so it's logged.
func (l *LocalCopy) write() {
	if l.path == "" {
		return
	}
	b, err := json.Marshal(l.file)
	if err == nil {
		err = writeFileAtomic(l.path, b, "local copy of the photo data")
	}
	if err != nil {
		slog.Warn("couldn't keep a local copy of the photo data", "err", err)
	}
}

func savedOf(s *snapshot) savedSnapshot {
	out := savedSnapshot{Commit: s.commit, Tree: s.tree, Files: make(map[string]savedFile, len(s.files))}
	for p, f := range s.files {
		out.Files[p] = savedFile{SHA: f.sha, Content: string(f.content), Err: f.err}
	}
	return out
}

// localCopy is c's LocalCopy, or one that keeps nothing when it has none.
func (c *Client) localCopy() *LocalCopy {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.Local == nil {
		c.Local = NewLocalCopy("")
	}
	return c.Local
}
