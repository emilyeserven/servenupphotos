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

// CombinedResult is ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the
// base branch and, when one is open, on the photo data pull request.
type CombinedResult struct {
	Repo   string       `json:"repo"`
	Folder string       `json:"folder"`
	Base   CombinedBase `json:"base"`
	// Head is nil when no pull request titled PullRequestTitle is open.
	Head *CombinedHead `json:"head"`
}

// Combined reads the combined lists on the base branch from
// Settings (or the default branch) and at the photo data pull request's head,
// so pages can keep them and only read them again after they're committed. It
// only reads from GitHub.
func (c *Client) Combined(ctx context.Context, gh settings.GitHub) (CombinedResult, error) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return CombinedResult{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return CombinedResult{}, perr
	}
	result := CombinedResult{
		Repo: t.repo.FullName, Folder: root,
		Base: CombinedBase{Branch: t.base, CombinedFiles: c.readCombinedFiles(ctx, t, root, t.base, t.base)},
	}
	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return CombinedResult{}, perr
	}
	if pr != nil {
		result.Head = &CombinedHead{
			PullRequest: InFlightPullRequest{
				Number: pr.Number, Title: pr.Title, URL: pr.HTMLURL, Branch: pr.Head.Ref, HeadSHA: pr.Head.SHA,
				BaseBranch: pr.Base.Ref,
			},
			CombinedFiles: c.readCombinedFiles(ctx, t, root, pr.Head.SHA, pr.Head.Ref),
		}
	}
	return result, nil
}

// readCombinedFiles reads each combined list in the data folder root at ref,
// linking the ones it finds to their page on branch.
func (c *Client) readCombinedFiles(ctx context.Context, t target, root, ref, branch string) CombinedFiles {
	read := func(folder, file string) InFlightAllPhotos {
		all := c.readCombined(ctx, t, root+"/"+folder+"/"+file, ref)
		if all.Found {
			all.FileURL = "https://github.com/" + t.repo.FullName + "/blob/" + escapePath(branch) + "/" + escapePath(all.Path)
		}
		return all
	}
	return CombinedFiles{
		Photos: read(PhotosFolder, AllPhotosFile),
		Albums: read(Albums.Folder, Albums.AllFile),
		Tags:   read(Tags.Folder, Tags.AllFile),
	}
}

// readCombined reads file, a combined list, at ref.
func (c *Client) readCombined(ctx context.Context, t target, file, ref string) InFlightAllPhotos {
	all := InFlightAllPhotos{Path: file}
	content, found, msg := c.readFile(ctx, t, all.Path, ref)
	all.Found = found
	if !found {
		return all
	}
	if msg != "" {
		all.Error = msg
		return all
	}
	entries := []json.RawMessage{}
	if err := json.Unmarshal(content, &entries); err != nil || entries == nil {
		all.Error = "The file isn't a JSON array."
		return all
	}
	all.Count = len(entries)
	all.Data = json.RawMessage(content)
	return all
}
