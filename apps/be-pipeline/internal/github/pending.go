package github

import (
	"context"
	"net/http"
	"path"
	"strings"
)

// Pending changes, as the sync button counts them.
const (
	PendingAdded    = "added"
	PendingModified = "modified"
	PendingDeleted  = "deleted"
)

// PendingFile is a data file the photo data pull request changed after the
// combined lists were last rebuilt, so they don't have it yet.
type PendingFile struct {
	// Kind is the combined list it goes in: photos, albums, tags, places or
	// localizations.
	Kind string `json:"kind"`
	Path string `json:"path"`
	// Change is PendingAdded, PendingModified or PendingDeleted.
	Change string `json:"change"`
}

// pendingFiles lists the data files changed between from and head, leaving
// out the combined lists themselves. It returns nil when GitHub can't compare
// them, since the sync status still holds without the list.
func (c *Client) pendingFiles(ctx context.Context, t target, root, from, head string) []PendingFile {
	var compared struct {
		Files []pullFile `json:"files"`
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/compare/"+from+"..."+head, t.token, nil, &compared)
	if check(res, err, "comparing the branch") != nil {
		return nil
	}
	pending := []PendingFile{}
	for _, f := range compared.Files {
		if kind := dataKind(root, f.Filename); kind != "" {
			pending = append(pending, PendingFile{Kind: kind, Path: f.Filename, Change: pendingChange(f.Status)})
		}
	}
	return pending
}

// dataKind is the combined list the data file at file goes in, or "" when it
// isn't a data file, such as a combined list.
func dataKind(root, file string) string {
	if !strings.EqualFold(path.Ext(file), ".json") {
		return ""
	}
	for _, k := range combinedKinds() {
		folder := root + "/" + k.folder
		if path.Dir(file) == folder && path.Base(file) != k.allFile {
			return k.name
		}
	}
	return ""
}

// pendingChange is how GitHub's file status changes the combined lists.
func pendingChange(status string) string {
	switch status {
	case "added", "copied":
		return PendingAdded
	case "removed":
		return PendingDeleted
	default:
		return PendingModified
	}
}
