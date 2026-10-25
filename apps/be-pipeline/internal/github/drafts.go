package github

import (
	"encoding/json"
	"strings"
)

// isDraft reports a photo file's JSON without a title: none, null, not text,
// or only spaces. Unless Settings say otherwise, a draft keeps its own file
// but is left out of AllPhotosFile, so the portfolio doesn't show it until
// it gets a title.
func isDraft(data json.RawMessage) bool {
	var photo struct {
		Title any `json:"title"`
	}
	if json.Unmarshal(data, &photo) != nil {
		return false
	}
	title, ok := photo.Title.(string)
	return !ok || strings.TrimSpace(title) == ""
}

// leftOut reports whether a file of kind with data is left out of its
// combined list: a photo draft, unless w includes untitled photos.
func (w *workspace) leftOut(kind combinedKind, data json.RawMessage) bool {
	return kind.name == "photos" && !w.onPortfolio(data)
}

// onPortfolio reports whether the photo file with data goes in AllPhotosFile:
// it isn't a draft, or w includes untitled photos.
func (w *workspace) onPortfolio(data json.RawMessage) bool {
	return w.includeUntitled || !isDraft(data)
}

// baseDrafts reads the photo files in folder on the base branch, unchanged
// by the photo data waiting to be merged (inFlightPhotos has those), that are
// drafts (see isDraft) AllPhotosFile there has no entry for. Pages only check
// AllPhotosFile on the base branch, which doesn't list them.
func (w *workspace) baseDrafts(folder string) (AllPhotosSource, []InFlightFile) {
	source := AllPhotosSource{Label: "the drafts on " + w.t.base, Found: true}
	listed := map[string]bool{}
	var entries []json.RawMessage
	_ = json.Unmarshal(w.base.files[folder+"/"+AllPhotosFile].content, &entries)
	for _, e := range entries {
		listed[canonicalJSON(e)] = true
	}
	var files []InFlightFile
	for _, p := range w.basePaths(folder, AllPhotosFile) {
		f := w.base.files[p]
		if w.status(p) != "" || f.err != "" || !json.Valid(f.content) || !isDraft(f.content) || listed[canonicalJSON(f.content)] {
			continue
		}
		files = append(files, InFlightFile{Path: p, FileURL: blobURL(w.t, w.t.base, p), Data: json.RawMessage(f.content)})
	}
	return source, files
}
