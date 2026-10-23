package github

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Stage keeps the data file changes saved in the app and not committed yet,
// for each repository, in a JSON file next to the settings, so a restart or a
// reload doesn't lose them. Every save goes here instead of to GitHub; Commit
// (CommitCombined) commits them all at once and drops them.
//
// Frontend analogy: it's a persisted Zustand store of unsaved edits, except
// the backend keeps it, so every page and every check (such as "is this file
// name taken?") sees the edits too.
type Stage struct {
	// path is the JSON file; "" keeps the changes in memory only.
	path string
	mu   sync.Mutex
	// repos is the changes by repository key (see repoKey), then by file path.
	repos  map[string]map[string]StagedFile
	loaded bool
}

// StagedFile is one data file as saved in the app: its whole new content, or
// Deleted.
type StagedFile struct {
	Content string `json:"content,omitempty"`
	Deleted bool   `json:"deleted,omitempty"`
	// Saved is when it was last saved.
	Saved time.Time `json:"saved"`
}

// data is the file content f saves, or nil when it deletes the file.
func (f StagedFile) data() []byte {
	if f.Deleted {
		return nil
	}
	return []byte(f.Content)
}

// NewStage returns a Stage kept in the JSON file at path, created on the
// first save. An empty path keeps it in memory only.
func NewStage(path string) *Stage {
	return &Stage{path: path}
}

// stageFile is the JSON file's content.
type stageFile struct {
	Repos map[string]map[string]StagedFile `json:"repos"`
}

// repoKey is the key a repository's changes are kept under.
func repoKey(t target) string {
	return strings.ToLower(t.owner + "/" + t.name)
}

// files returns a copy of the changes kept for t's repository, by path.
func (s *Stage) files(t target) (map[string]StagedFile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := map[string]StagedFile{}
	for p, f := range s.repos[repoKey(t)] {
		out[p] = f
	}
	return out, nil
}

// update changes the changes kept for t's repository with change, which gets
// them by path, and saves them.
func (s *Stage) update(t target, change func(files map[string]StagedFile)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	key := repoKey(t)
	files := s.repos[key]
	if files == nil {
		files = map[string]StagedFile{}
	}
	change(files)
	if len(files) == 0 {
		delete(s.repos, key)
	} else {
		s.repos[key] = files
	}
	return s.save()
}

func (s *Stage) load() error {
	if s.loaded {
		return nil
	}
	s.repos = map[string]map[string]StagedFile{}
	if s.path == "" {
		s.loaded = true
		return nil
	}
	b, err := os.ReadFile(s.path)
	if errors.Is(err, fs.ErrNotExist) {
		s.loaded = true
		return nil
	}
	if err != nil {
		return fmt.Errorf("read pending changes: %w", err)
	}
	var file stageFile
	if err := json.Unmarshal(b, &file); err != nil {
		return fmt.Errorf("parse pending changes: %w", err)
	}
	if file.Repos != nil {
		s.repos = file.Repos
	}
	s.loaded = true
	return nil
}

// save writes to a temp file and renames it over the old one, so a crash
// mid-write never leaves a truncated file.
func (s *Stage) save() error {
	if s.path == "" {
		return nil
	}
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create pending changes dir: %w", err)
	}
	b, err := json.MarshalIndent(stageFile{Repos: s.repos}, "", "  ")
	if err != nil {
		return fmt.Errorf("encode pending changes: %w", err)
	}
	tmp, err := os.CreateTemp(dir, ".pending-*.json")
	if err != nil {
		return fmt.Errorf("create temp pending changes: %w", err)
	}
	defer os.Remove(tmp.Name()) //nolint:errcheck // gone after the rename
	if _, err := tmp.Write(b); err != nil {
		tmp.Close() //nolint:errcheck,gosec // the write failed already
		return fmt.Errorf("write pending changes: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close pending changes: %w", err)
	}
	if err := os.Rename(tmp.Name(), s.path); err != nil {
		return fmt.Errorf("save pending changes: %w", err)
	}
	return nil
}

// stage is c's Stage, or one in memory when it has none.
func (c *Client) stage() *Stage {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.Stage == nil {
		c.Stage = NewStage("")
	}
	return c.Stage
}
