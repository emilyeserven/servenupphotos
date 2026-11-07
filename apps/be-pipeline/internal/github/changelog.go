package github

import (
	"context"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// changelogPageSize is how many commits one page of the Changelog reads from
// GitHub, the most GitHub's list commits endpoint gives at once.
const changelogPageSize = 100

// ChangelogEntry is one change on the base branch, for the Changelog page:
// usually a squash-merged pull request, or a commit pushed straight to it.
type ChangelogEntry struct {
	// SHA is the commit's full ID.
	SHA string `json:"sha"`
	// Title is the first line of the commit message, without the pull
	// request number GitHub adds to a squash merge, such as " (#434)".
	Title string `json:"title"`
	// PullRequest is the number of the pull request the commit merged, or 0
	// when the commit doesn't name one.
	PullRequest int `json:"pullRequest,omitempty"`
	// PullRequestURL is the pull request's page on GitHub, when there is one.
	PullRequestURL string `json:"pullRequestUrl,omitempty"`
	// CommitURL is the commit's page on GitHub.
	CommitURL string `json:"commitUrl"`
	// Author is the GitHub login of who wrote the change, or the name in the
	// commit when it isn't linked to a GitHub account.
	Author string `json:"author"`
	// Date is when the change landed on the branch, as RFC 3339.
	Date string `json:"date"`
	// PhotoData is true for a merged photo data pull request ("Add photo
	// data"), which changes the portfolio's photos rather than the code.
	PhotoData bool `json:"photoData"`
}

// Changelog is one page of the changes on the base branch, newest first.
type Changelog struct {
	// Repo is the repository as owner/name.
	Repo string `json:"repo"`
	// Branch is the base branch the changes are on.
	Branch string `json:"branch"`
	// Entries are the page's changes, newest first, without merge commits.
	Entries []ChangelogEntry `json:"entries"`
	// NextPage is the page with older changes, or 0 when this is the last.
	NextPage int `json:"nextPage"`
}

// listedCommit is the part of one item of GET /repos/{owner}/{repo}/commits
// the Changelog uses.
type listedCommit struct {
	SHA     string `json:"sha"`
	HTMLURL string `json:"html_url"`
	Commit  struct {
		Message string `json:"message"`
		Author  struct {
			Name string `json:"name"`
		} `json:"author"`
		Committer struct {
			Date string `json:"date"`
		} `json:"committer"`
	} `json:"commit"`
	Author *struct {
		Login string `json:"login"`
	} `json:"author"`
	Parents []struct {
		SHA string `json:"sha"`
	} `json:"parents"`
}

// pullRequestSuffix is the " (#123)" GitHub puts at the end of a squash
// merge's title.
var pullRequestSuffix = regexp.MustCompile(`\s*\(#(\d+)\)$`)

// mergeTitle matches the titles git and GitHub give merge commits, such as
// "Merge branch 'main' into feature", which say nothing about the change.
var mergeTitle = regexp.MustCompile(`^Merge (branch|remote-tracking branch|pull request) `)

// Changelog reads one page (from 1) of the commits on gh's base branch, the
// default branch when gh's is blank, newest first, leaving out merge commits.
// It only reads.
func (c *Client) Changelog(ctx context.Context, gh settings.GitHub, page int) (Changelog, error) {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok {
		return Changelog{}, publishErr(http.StatusBadRequest, "Enter the repository in Settings as owner/name.")
	}
	if gh.Token == "" {
		return Changelog{}, publishErr(http.StatusBadRequest, "Set a GitHub token in Settings first.")
	}
	branch, perr := c.changelogBranch(ctx, owner, name, gh)
	if perr != nil {
		return Changelog{}, perr
	}

	q := url.Values{"sha": {branch}, "per_page": {strconv.Itoa(changelogPageSize)}, "page": {strconv.Itoa(max(page, 1))}}
	var listed []listedCommit
	res, err := c.do(ctx, http.MethodGet, repoPath(owner, name)+"/commits?"+q.Encode(), gh.Token, nil, &listed)
	if perr := readCheck(res, err, "reading the branch's commits"); perr != nil {
		return Changelog{}, perr
	}

	log := Changelog{Repo: owner + "/" + name, Branch: branch, Entries: changelogEntries(owner+"/"+name, listed)}
	if hasNextPage(res.Header) {
		log.NextPage = max(page, 1) + 1
	}
	return log, nil
}

// changelogBranch is gh's base branch, or the repository's default branch
// when gh names none.
func (c *Client) changelogBranch(ctx context.Context, owner, name string, gh settings.GitHub) (string, *PublishError) {
	if branch := strings.TrimSpace(gh.Branch); branch != "" {
		return branch, nil
	}
	repo, msg := c.getRepo(ctx, owner, name, gh.Token)
	if msg != "" {
		return "", publishErr(http.StatusBadGateway, "%s", msg)
	}
	return repo.DefaultBranch, nil
}

// changelogEntries turns the listed commits of repo (owner/name) into
// Changelog entries, in the same order, leaving out merge commits.
func changelogEntries(repo string, listed []listedCommit) []ChangelogEntry {
	entries := []ChangelogEntry{}
	for _, lc := range listed {
		title, _, _ := strings.Cut(strings.TrimSpace(lc.Commit.Message), "\n")
		if isMergeCommit(lc, title) {
			continue
		}
		entries = append(entries, changelogEntry(repo, lc, strings.TrimSpace(title)))
	}
	return entries
}

// isMergeCommit reports a commit that only merges branches: one with two
// parents or more, or one titled like a merge.
func isMergeCommit(lc listedCommit, title string) bool {
	return len(lc.Parents) > 1 || mergeTitle.MatchString(title)
}

// changelogEntry is lc, a commit of repo titled title, as a Changelog entry.
func changelogEntry(repo string, lc listedCommit, title string) ChangelogEntry {
	e := ChangelogEntry{
		SHA: lc.SHA, Title: title, CommitURL: lc.HTMLURL, Author: lc.Commit.Author.Name, Date: lc.Commit.Committer.Date,
	}
	if lc.Author != nil && lc.Author.Login != "" {
		e.Author = lc.Author.Login
	}
	if m := pullRequestSuffix.FindStringSubmatch(title); m != nil {
		e.Title = strings.TrimSpace(title[:len(title)-len(m[0])])
		e.PullRequest, _ = strconv.Atoi(m[1])
		e.PullRequestURL = "https://github.com/" + repo + "/pull/" + m[1]
	}
	e.PhotoData = e.Title == PullRequestTitle
	return e
}

// hasNextPage reports whether GitHub's Link header points to a next page.
func hasNextPage(header http.Header) bool {
	return strings.Contains(header.Get("Link"), `rel="next"`)
}
