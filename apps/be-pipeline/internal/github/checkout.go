package github

import (
	"os"
	"path/filepath"
	"strings"
)

// addCheckoutBlobs adds the content of the .json files directly in each of
// root's data subfolders in checkout to known, by blob SHA, as Git would name
// them. A file that differs from GitHub's, such as in an older clone, just
// doesn't match, and is downloaded instead.
//
// > Frontend analogy: like a service worker answering from its precache
// > whenever an asset's content hash matches, and fetching only the rest.
func addCheckoutBlobs(known map[string][]byte, checkout, root string) {
	if checkout == "" {
		return
	}
	for _, k := range combinedKinds() {
		addFolderBlobs(known, filepath.Join(checkout, filepath.FromSlash(root), k.folder))
	}
}

// addFolderBlobs adds the .json files directly in dir to known; a folder that
// isn't there, or a file that can't be read, adds nothing.
func addFolderBlobs(known map[string][]byte, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || !strings.EqualFold(filepath.Ext(e.Name()), ".json") {
			continue
		}
		if content, err := os.ReadFile(filepath.Join(dir, e.Name())); err == nil { //nolint:gosec // A file listed in the configured checkout.
			known[blobSHA(content)] = content
		}
	}
}
