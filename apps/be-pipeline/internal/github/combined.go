package github

import (
	"context"
	"encoding/json"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// CombinedFiles is the combined lists CommitCombined builds, each read at one ref.
type CombinedFiles struct {
	Photos InFlightAllPhotos `json:"photos"`
	Albums InFlightAllPhotos `json:"albums"`
	Tags   InFlightAllPhotos `json:"tags"`
	// Places and Localizations are PLACES.json and LOCALIZATIONS.json.
	Places        InFlightAllPhotos `json:"places"`
	Localizations InFlightAllPhotos `json:"localizations"`
	// MetaInfo is METAINFO.json, the metadata groups.
	MetaInfo InFlightAllPhotos `json:"metainfo"`
}

// CombinedBase is CombinedFiles on the base branch: what the portfolio has.
type CombinedBase struct {
	Branch string `json:"branch"`
	CombinedFiles
}

// CombinedHead is CombinedFiles at the photo data pull request's head, as
// they were last committed there.
type CombinedHead struct {
	PullRequest InFlightPullRequest `json:"pullRequest"`
	CombinedFiles
}

// CombinedResult is ALLPHOTOS.json, ALLALBUMS.json, ALLTAGS.json, PLACES.json
// and LOCALIZATIONS.json on the base branch and, when one is open, on the
// photo data pull request.
type CombinedResult struct {
	Repo   string       `json:"repo"`
	Folder string       `json:"folder"`
	Base   CombinedBase `json:"base"`
	// Head is nil when no pull request titled PullRequestTitle is open.
	Head *CombinedHead `json:"head"`
	// IncludeUntitled is Settings' choice to put untitled photos in
	// AllPhotosFile too; false keeps them out as drafts.
	IncludeUntitled bool `json:"includeUntitled"`
}

// Combined reads the combined lists on the base branch from Settings (or the
// default branch) and at the photo data pull request's head, as they were
// last committed, so pages can keep them and only read them again after
// they're committed.
func (c *Client) Combined(ctx context.Context, gh settings.GitHub) (CombinedResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return CombinedResult{}, perr
	}
	result := CombinedResult{
		Repo: w.t.repo.FullName, Folder: w.root, IncludeUntitled: w.includeUntitled,
		Base: CombinedBase{Branch: w.t.base, CombinedFiles: combinedFiles(w.t, w.root, w.base, w.t.base)},
	}
	if pr := w.inFlightPullRequest(); pr != nil {
		result.Head = &CombinedHead{PullRequest: *pr, CombinedFiles: combinedFiles(w.t, w.root, w.head, pr.Branch)}
	}
	return result, nil
}

// combinedFiles is each combined list in the data folder root in s, linked to
// its page on branch.
func combinedFiles(t target, root string, s *snapshot, branch string) CombinedFiles {
	read := func(folder, file string) InFlightAllPhotos {
		all := readCombined(s, root+"/"+folder+"/"+file)
		if all.Found {
			all.FileURL = blobURL(t, branch, all.Path)
		}
		return all
	}
	return CombinedFiles{
		Photos:        read(PhotosFolder, AllPhotosFile),
		Albums:        read(Albums.Folder, Albums.AllFile),
		Tags:          read(Tags.Folder, Tags.AllFile),
		Places:        read(Places.Folder, Places.AllFile),
		Localizations: read(Localizations.Folder, Localizations.AllFile),
		MetaInfo:      read(MetaInfo.Folder, MetaInfo.AllFile),
	}
}

// readCombined is file, a combined list, in s.
func readCombined(s *snapshot, file string) InFlightAllPhotos {
	all := InFlightAllPhotos{Path: file}
	f, found := s.files[file]
	all.Found = found
	if !found {
		return all
	}
	if f.err != "" {
		all.Error = f.err
		return all
	}
	entries := []json.RawMessage{}
	if err := json.Unmarshal(f.content, &entries); err != nil || entries == nil {
		all.Error = "The file isn't a JSON array."
		return all
	}
	all.Count = len(entries)
	all.Data = json.RawMessage(f.content)
	return all
}
