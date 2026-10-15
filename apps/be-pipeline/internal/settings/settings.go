// Package settings persists the pipeline's integration settings (Cloudflare R2,
// GitHub) to a JSON file. Secret fields are write-only: they can be set,
// replaced, or cleared, but the store only ever hands back whether one is set
// and its last four characters.
package settings

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
)

// R2 holds Cloudflare R2 bucket settings. SecretAccessKey is a secret.
type R2 struct {
	AccountID       string `json:"accountId"`
	AccessKeyID     string `json:"accessKeyId"`
	SecretAccessKey string `json:"secretAccessKey"`
	Bucket          string `json:"bucket"`
	PublicURL       string `json:"publicUrl"`
}

// GitHub holds the repository that photo JSON is written to. Token is a secret.
type GitHub struct {
	Repo   string `json:"repo"`
	Branch string `json:"branch"`
	Folder string `json:"folder"`
	Token  string `json:"token"`
}

// Settings is everything the store persists.
type Settings struct {
	R2     R2     `json:"r2"`
	GitHub GitHub `json:"github"`
}

// SecretStatus is the only view of a secret that ever leaves the store.
type SecretStatus struct {
	Set   bool   `json:"set"`
	Last4 string `json:"last4,omitempty"`
}

// PublicR2 is R2 with its secret replaced by a SecretStatus.
type PublicR2 struct {
	AccountID       string       `json:"accountId"`
	AccessKeyID     string       `json:"accessKeyId"`
	SecretAccessKey SecretStatus `json:"secretAccessKey"`
	Bucket          string       `json:"bucket"`
	PublicURL       string       `json:"publicUrl"`
}

// PublicGitHub is GitHub with its secret replaced by a SecretStatus.
type PublicGitHub struct {
	Repo   string       `json:"repo"`
	Branch string       `json:"branch"`
	Folder string       `json:"folder"`
	Token  SecretStatus `json:"token"`
}

// Public is the client-safe view of Settings.
type Public struct {
	R2     PublicR2     `json:"r2"`
	GitHub PublicGitHub `json:"github"`
}

// R2Update replaces the R2 settings. A nil SecretAccessKey keeps the stored
// secret, an empty one clears it, and anything else replaces it.
type R2Update struct {
	AccountID       string  `json:"accountId"`
	AccessKeyID     string  `json:"accessKeyId"`
	SecretAccessKey *string `json:"secretAccessKey"`
	Bucket          string  `json:"bucket"`
	PublicURL       string  `json:"publicUrl"`
}

// GitHubUpdate replaces the GitHub settings, with Token following the same
// keep / clear / replace rules as R2Update.SecretAccessKey.
type GitHubUpdate struct {
	Repo   string  `json:"repo"`
	Branch string  `json:"branch"`
	Folder string  `json:"folder"`
	Token  *string `json:"token"`
}

// Store reads and writes Settings at a file path.
type Store struct {
	path string
	mu   sync.Mutex
}

// NewStore returns a Store backed by the file at path. The file and its
// directory are created on the first write.
func NewStore(path string) *Store {
	return &Store{path: path}
}

// Get returns the client-safe view of the stored settings.
func (s *Store) Get() (Public, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, err := s.load()
	if err != nil {
		return Public{}, err
	}
	return cur.public(), nil
}

// UpdateR2 replaces the R2 settings and returns the new client-safe view.
func (s *Store) UpdateR2(u R2Update) (Public, error) {
	return s.update(func(cur *Settings) {
		cur.R2 = u.apply(cur.R2)
	})
}

// R2 returns the stored R2 settings, secret included, for talking to R2.
func (s *Store) R2() (R2, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, err := s.load()
	return cur.R2, err
}

// ResolveR2 returns the R2 settings an update would produce, using the stored
// secret when the update keeps it, without saving anything.
func (s *Store) ResolveR2(u R2Update) (R2, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, err := s.load()
	if err != nil {
		return R2{}, err
	}
	return u.apply(cur.R2), nil
}

// UpdateGitHub replaces the GitHub settings and returns the new client-safe view.
func (s *Store) UpdateGitHub(u GitHubUpdate) (Public, error) {
	return s.update(func(cur *Settings) {
		cur.GitHub = GitHub{
			Repo:   u.Repo,
			Branch: u.Branch,
			Folder: u.Folder,
			Token:  applySecret(cur.GitHub.Token, u.Token),
		}
	})
}

func (s *Store) update(apply func(*Settings)) (Public, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, err := s.load()
	if err != nil {
		return Public{}, err
	}
	apply(&cur)
	if err := s.save(cur); err != nil {
		return Public{}, err
	}
	return cur.public(), nil
}

func (s *Store) load() (Settings, error) {
	var cur Settings
	b, err := os.ReadFile(s.path)
	if errors.Is(err, fs.ErrNotExist) {
		return cur, nil
	}
	if err != nil {
		return cur, fmt.Errorf("read settings: %w", err)
	}
	if err := json.Unmarshal(b, &cur); err != nil {
		return cur, fmt.Errorf("parse settings: %w", err)
	}
	return cur, nil
}

// save writes to a temp file and renames it over the old one, so a crash
// mid-write never leaves a truncated settings file. The file is owner-only
// because it holds secrets.
func (s *Store) save(cur Settings) error {
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create settings dir: %w", err)
	}
	b, err := json.MarshalIndent(cur, "", "  ")
	if err != nil {
		return fmt.Errorf("encode settings: %w", err)
	}
	tmp, err := os.CreateTemp(dir, ".settings-*.json")
	if err != nil {
		return fmt.Errorf("create temp settings: %w", err)
	}
	defer os.Remove(tmp.Name()) //nolint:errcheck // no-op after a successful rename
	if _, err := tmp.Write(b); err != nil {
		tmp.Close() //nolint:errcheck,gosec // already failing
		return fmt.Errorf("write settings: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("write settings: %w", err)
	}
	if err := os.Rename(tmp.Name(), s.path); err != nil {
		return fmt.Errorf("replace settings: %w", err)
	}
	return nil
}

func (cur Settings) public() Public {
	return Public{
		R2: PublicR2{
			AccountID:       cur.R2.AccountID,
			AccessKeyID:     cur.R2.AccessKeyID,
			SecretAccessKey: status(cur.R2.SecretAccessKey),
			Bucket:          cur.R2.Bucket,
			PublicURL:       cur.R2.PublicURL,
		},
		GitHub: PublicGitHub{
			Repo:   cur.GitHub.Repo,
			Branch: cur.GitHub.Branch,
			Folder: cur.GitHub.Folder,
			Token:  status(cur.GitHub.Token),
		},
	}
}

func applySecret(stored string, next *string) string {
	if next == nil {
		return stored
	}
	return *next
}

// status reports whether a secret is set and, for secrets long enough that it
// gives little away, its last four characters.
func status(secret string) SecretStatus {
	if secret == "" {
		return SecretStatus{}
	}
	if len(secret) < 12 {
		return SecretStatus{Set: true}
	}
	return SecretStatus{Set: true, Last4: secret[len(secret)-4:]}
}

func (u R2Update) apply(cur R2) R2 {
	return R2{
		AccountID:       u.AccountID,
		AccessKeyID:     u.AccessKeyID,
		SecretAccessKey: applySecret(cur.SecretAccessKey, u.SecretAccessKey),
		Bucket:          u.Bucket,
		PublicURL:       u.PublicURL,
	}
}
