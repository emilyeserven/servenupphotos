package github

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// Check reports whether gh's token can see gh's repository and branch, without
// changing anything. A blank branch means the repository's default branch. It
// cannot confirm write access, which GitHub only proves on a real commit.
func (c *Client) Check(ctx context.Context, gh settings.GitHub) storage.CheckResult {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok {
		return fail("Enter the repository as owner/name.")
	}
	if gh.Token == "" {
		return fail("Set a personal access token first.")
	}

	repo, msg := c.getRepo(ctx, owner, name, gh.Token)
	if msg != "" {
		return fail(msg)
	}

	branch := strings.TrimSpace(gh.Branch)
	if branch == "" {
		branch = repo.DefaultBranch
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(owner, name)+"/branches/"+escapePath(branch), gh.Token, nil, nil)
	if err != nil {
		return fail("Couldn't reach GitHub.")
	}
	switch {
	case isRateLimited(res):
		return fail(rateLimitMessage(res.Header, c.now()))
	case res.Status == http.StatusNotFound:
		return fail(fmt.Sprintf("Branch %q wasn't found in %s.", branch, repo.FullName))
	case res.Status != http.StatusOK:
		return fail(fmt.Sprintf("GitHub responded %d when looking up the branch.", res.Status))
	}

	return storage.CheckResult{OK: true, Message: fmt.Sprintf("Connected to %s on branch %s.", repo.FullName, branch)}
}

func fail(message string) storage.CheckResult {
	return storage.CheckResult{Message: message}
}
