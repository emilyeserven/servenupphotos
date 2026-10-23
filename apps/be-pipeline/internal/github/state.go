package github

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// stateTTL is how long a read of where the repository stands (its base
// branch's head and the open photo data pull request) is used again before
// GitHub is asked again. Nothing but Commit changes them from the app, and
// Commit updates the cached read itself, so this only bounds how long a merge
// or push made on GitHub takes to show.
const stateTTL = 30 * time.Second

// repoState is where the repository stands: its base branch's head commit and
// the open photo data pull request, if any.
type repoState struct {
	t        target
	baseHead string
	// pr is nil when no photo data pull request is open.
	pr *inFlightPull
	at time.Time
	// key is what it's cached by (see stateKey).
	key string
}

// stateQuery reads the repository, its base branch's head and its open pull
// requests in one GraphQL query.
const stateQuery = `query($owner: String!, $name: String!, $base: String!, $hasBase: Boolean!) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    defaultBranchRef { name target { oid } }
    ref(qualifiedName: $base) @include(if: $hasBase) { target { oid } }
    pullRequests(states: OPEN, first: 100, orderBy: {field: CREATED_AT, direction: ASC}) {
      nodes { number title url headRefName headRefOid baseRefName }
    }
  }
}`

// stateAnswer is the data of stateQuery.
type stateAnswer struct {
	Repository *struct {
		NameWithOwner    string `json:"nameWithOwner"`
		DefaultBranchRef *struct {
			Name   string    `json:"name"`
			Target gitObject `json:"target"`
		} `json:"defaultBranchRef"`
		Ref          *struct{ Target gitObject } `json:"ref"`
		PullRequests struct {
			Nodes []struct {
				Number      int    `json:"number"`
				Title       string `json:"title"`
				URL         string `json:"url"`
				HeadRefName string `json:"headRefName"`
				HeadRefOid  string `json:"headRefOid"`
				BaseRefName string `json:"baseRefName"`
			} `json:"nodes"`
		} `json:"pullRequests"`
	} `json:"repository"`
}

// gitObject is a GraphQL Git object, by its ID.
type gitObject struct {
	OID string `json:"oid"`
}

// state returns where gh's repository stands, from a read at most stateTTL
// old unless fresh is true.
func (c *Client) state(ctx context.Context, gh settings.GitHub, fresh bool) (repoState, *PublishError) {
	if perr := setUp(gh); perr != nil {
		return repoState{}, perr
	}
	owner, name, _ := splitRepo(gh.Repo)
	key := stateKey(gh)
	if s, ok := c.reads().state(key); ok && !fresh && c.now().Sub(s.at) < stateTTL {
		return s, nil
	}
	t := target{owner: owner, name: name, token: gh.Token, base: strings.TrimSpace(gh.Branch)}
	var answer stateAnswer
	vars := map[string]any{"owner": owner, "name": name, "base": "refs/heads/" + t.base, "hasBase": t.base != ""}
	if perr := c.graphql(ctx, t, stateQuery, vars, &answer, "looking up the repository"); perr != nil {
		return repoState{}, perr
	}
	s, perr := stateOf(t, answer)
	if perr != nil {
		return repoState{}, perr
	}
	s.at, s.key = c.now(), key
	c.reads().setState(key, s)
	return s, nil
}

// stateOf is the repoState in answer for t.
func stateOf(t target, answer stateAnswer) (repoState, *PublishError) {
	repo := answer.Repository
	if repo == nil {
		return repoState{}, publishErr(http.StatusBadGateway, "Repository %s/%s wasn't found, or the token can't see it.", t.owner, t.name)
	}
	t.repo.FullName = repo.NameWithOwner
	s := repoState{t: t}
	if repo.DefaultBranchRef != nil {
		t.repo.DefaultBranch = repo.DefaultBranchRef.Name
		s.baseHead = repo.DefaultBranchRef.Target.OID
	}
	if t.base == "" {
		t.base = t.repo.DefaultBranch
	} else {
		s.baseHead = ""
		if repo.Ref != nil {
			s.baseHead = repo.Ref.Target.OID
		}
	}
	if s.baseHead == "" {
		return repoState{}, publishErr(http.StatusBadGateway, "Branch %q wasn't found in %s.", t.base, t.repo.FullName)
	}
	s.t = t
	for _, pr := range repo.PullRequests.Nodes {
		if strings.TrimSpace(pr.Title) != PullRequestTitle {
			continue
		}
		s.pr = &inFlightPull{Number: pr.Number, Title: pr.Title, HTMLURL: pr.URL}
		s.pr.Head.Ref, s.pr.Head.SHA, s.pr.Base.Ref = pr.HeadRefName, pr.HeadRefOid, pr.BaseRefName
		break
	}
	return s, nil
}

// setUp fails unless gh has a repository and a token.
func setUp(gh settings.GitHub) *PublishError {
	if _, _, ok := splitRepo(gh.Repo); !ok || gh.Token == "" {
		return publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	return nil
}

// stateKey is what a repoState is cached by: the settings that pick it.
func stateKey(gh settings.GitHub) string {
	return strings.Join([]string{strings.TrimSpace(gh.Repo), strings.TrimSpace(gh.Branch), gh.Token}, "\x00")
}

// inFlightPullRequest is s's pull request as pages show it, or nil.
func (s repoState) inFlightPullRequest() *InFlightPullRequest {
	if s.pr == nil {
		return nil
	}
	return &InFlightPullRequest{
		Number: s.pr.Number, Title: s.pr.Title, URL: s.pr.HTMLURL, Branch: s.pr.Head.Ref, HeadSHA: s.pr.Head.SHA,
		BaseBranch: s.pr.Base.Ref,
	}
}
