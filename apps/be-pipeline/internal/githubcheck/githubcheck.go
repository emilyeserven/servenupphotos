// Package githubcheck tests GitHub settings against the GitHub REST API without
// changing anything: it confirms the token works, can see the repository, and
// that the branch exists. It cannot confirm write access, which GitHub only
// proves on a real commit.
package githubcheck

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// DefaultBaseURL is GitHub's public REST API.
const DefaultBaseURL = "https://api.github.com"

// Checker calls the GitHub REST API at BaseURL.
type Checker struct {
	BaseURL string
	Client  *http.Client
}

// New returns a Checker for GitHub's public API.
func New() *Checker {
	return &Checker{BaseURL: DefaultBaseURL, Client: http.DefaultClient}
}

// Check reports whether gh's token can see gh's repository and branch. A blank
// branch means the repository's default branch.
func (c *Checker) Check(ctx context.Context, gh settings.GitHub) storage.CheckResult {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok {
		return fail("Enter the repository as owner/name.")
	}
	if gh.Token == "" {
		return fail("Set a personal access token first.")
	}

	repoPath := "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(name)
	var repo struct {
		FullName      string `json:"full_name"`
		DefaultBranch string `json:"default_branch"`
	}
	status, header, err := c.get(ctx, repoPath, gh.Token, &repo)
	if err != nil {
		return fail("Couldn't reach GitHub.")
	}
	switch {
	case status == http.StatusUnauthorized:
		return fail("GitHub rejected the token. It may be wrong, expired or revoked.")
	case isRateLimited(status, header):
		return fail("GitHub's rate limit was hit. Try again in a few minutes.")
	case status == http.StatusForbidden:
		return fail("The token isn't allowed to access this repository.")
	case status == http.StatusNotFound:
		return fail(fmt.Sprintf("Repository %s/%s wasn't found, or the token can't see it.", owner, name))
	case status != http.StatusOK:
		return fail(fmt.Sprintf("GitHub responded %d when looking up the repository.", status))
	}

	branch := strings.TrimSpace(gh.Branch)
	if branch == "" {
		branch = repo.DefaultBranch
	}
	status, header, err = c.get(ctx, repoPath+"/branches/"+escapeBranch(branch), gh.Token, nil)
	if err != nil {
		return fail("Couldn't reach GitHub.")
	}
	switch {
	case isRateLimited(status, header):
		return fail("GitHub's rate limit was hit. Try again in a few minutes.")
	case status == http.StatusNotFound:
		return fail(fmt.Sprintf("Branch %q wasn't found in %s.", branch, repo.FullName))
	case status != http.StatusOK:
		return fail(fmt.Sprintf("GitHub responded %d when looking up the branch.", status))
	}

	return storage.CheckResult{OK: true, Message: fmt.Sprintf("Connected to %s on branch %s.", repo.FullName, branch)}
}

// get requests path with the token and, on a 200, decodes the body into out
// when out is non-nil. The token goes only in the Authorization header.
func (c *Checker) get(ctx context.Context, path, token string, out any) (int, http.Header, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(c.BaseURL, "/")+path, nil)
	if err != nil {
		return 0, nil, fmt.Errorf("build request: %w", err)
	}
	// Headers recommended by https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "servenupphotos-pipeline")

	res, err := c.Client.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("github request: %w", err)
	}
	defer res.Body.Close() //nolint:errcheck // read-only

	if res.StatusCode == http.StatusOK && out != nil {
		if err := json.NewDecoder(res.Body).Decode(out); err != nil {
			return 0, nil, fmt.Errorf("decode github response: %w", err)
		}
	}
	return res.StatusCode, res.Header, nil
}

// splitRepo parses "owner/name", ignoring surrounding spaces.
func splitRepo(repo string) (owner, name string, ok bool) {
	owner, name, ok = strings.Cut(strings.TrimSpace(repo), "/")
	if !ok || owner == "" || name == "" || strings.Contains(name, "/") {
		return "", "", false
	}
	return owner, name, true
}

// escapeBranch escapes each segment of a branch name, keeping the slashes that
// GitHub's branch endpoint accepts as part of the name.
func escapeBranch(branch string) string {
	segments := strings.Split(branch, "/")
	for i, s := range segments {
		segments[i] = url.PathEscape(s)
	}
	return strings.Join(segments, "/")
}

// isRateLimited reports a primary rate limit response, per
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
func isRateLimited(status int, header http.Header) bool {
	return (status == http.StatusForbidden || status == http.StatusTooManyRequests) &&
		header.Get("X-RateLimit-Remaining") == "0"
}

func fail(message string) storage.CheckResult {
	return storage.CheckResult{Message: message}
}
