package github

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// dispatchRun is what GitHub answers a workflow dispatch with when asked for
// the run it started.
type dispatchRun struct {
	HTMLURL string `json:"html_url"`
}

// Rebuild starts the CombineWorkflowFile run that rebuilds AllPhotosFile, and
// each Kind's AllFile, on the open pull request titled PullRequestTitle, and
// reports it as waiting at the pull request's head. Follow it with Combine and
// that SHA. The token needs Actions read and write access.
func (c *Client) Rebuild(ctx context.Context, gh settings.GitHub) (CombineStatus, error) {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return CombineStatus{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	t := target{owner: owner, name: name, token: gh.Token}
	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return CombineStatus{}, perr
	}
	if pr == nil {
		return CombineStatus{}, publishErr(http.StatusNotFound, "No pull request titled %q is open.", PullRequestTitle)
	}

	p := repoPath(owner, name) + "/actions/workflows/" + CombineWorkflowFile + "/dispatches"
	body := map[string]any{"ref": pr.Head.Ref, "return_run_details": true}
	var run dispatchRun
	res, err := c.do(ctx, http.MethodPost, p, t.token, body, &run)
	if perr := dispatchCheck(res, err); perr != nil {
		return CombineStatus{}, perr
	}
	return CombineStatus{
		SHA: pr.Head.SHA, State: CombineWaiting, RunURL: run.HTMLURL,
		RunsURL: "https://github.com/" + owner + "/" + name + "/actions/workflows/" + CombineWorkflowFile,
	}, nil
}

// dispatchCheck is check for starting CombineWorkflowFile, with what each
// refusal usually means.
func dispatchCheck(res response, err error) *PublishError {
	switch {
	case err != nil || res.Status == http.StatusUnauthorized || isRateLimited(res) ||
		(res.Status >= 200 && res.Status < 300):
		return check(res, err, "starting the rebuild")
	case res.Status == http.StatusForbidden:
		return publishErr(http.StatusBadGateway,
			"The token can't start workflows. Give it Actions read and write access.")
	case res.Status == http.StatusNotFound:
		return publishErr(http.StatusBadGateway,
			"GitHub couldn't find the %s workflow, or the token can't start it. Give the token Actions read and write access.", CombineWorkflowFile)
	case res.Status == http.StatusUnprocessableEntity:
		return publishErr(http.StatusBadGateway,
			"The pull request's branch has an older %s that can't be started by hand. Update the branch from the base branch, then try again.", CombineWorkflowFile)
	default:
		return check(res, err, "starting the rebuild")
	}
}
