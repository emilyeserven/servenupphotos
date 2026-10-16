// Package github talks to the GitHub REST API with the token from Settings.
// Check tests the settings without changing anything, Publish saves a photo's
// sanitized EXIF as a JSON file in a pull request, InFlight reads back the
// photo JSON waiting in that pull request, and Remove deletes one of them.
package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DefaultBaseURL is GitHub's public REST API.
const DefaultBaseURL = "https://api.github.com"

// Client calls the GitHub REST API at BaseURL.
type Client struct {
	BaseURL string
	Client  *http.Client
	// Now names new branches; nil means time.Now.
	Now func() time.Time
}

// New returns a Client for GitHub's public API.
func New() *Client {
	return &Client{BaseURL: DefaultBaseURL, Client: http.DefaultClient}
}

// response is the part of a GitHub response the callers look at.
type response struct {
	Status int
	Header http.Header
}

// do sends a request to path with the token and, when in is non-nil, in as a
// JSON body. On a 2xx response it decodes the body into out when out is
// non-nil. The token goes only in the Authorization header.
func (c *Client) do(ctx context.Context, method, path, token string, in, out any) (response, error) {
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return response{}, fmt.Errorf("encode github request: %w", err)
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(c.BaseURL, "/")+path, body)
	if err != nil {
		return response{}, fmt.Errorf("build request: %w", err)
	}
	// Headers recommended by https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "servenupphotos-pipeline")
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.Client.Do(req)
	if err != nil {
		return response{}, fmt.Errorf("github request: %w", err)
	}
	defer res.Body.Close() //nolint:errcheck // read-only

	if res.StatusCode >= 200 && res.StatusCode < 300 && out != nil {
		if err := json.NewDecoder(res.Body).Decode(out); err != nil {
			return response{}, fmt.Errorf("decode github response: %w", err)
		}
	}
	return response{Status: res.StatusCode, Header: res.Header}, nil
}

// repoPath returns the API path of owner/name.
func repoPath(owner, name string) string {
	return "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(name)
}

// splitRepo parses "owner/name", ignoring surrounding spaces.
func splitRepo(repo string) (owner, name string, ok bool) {
	owner, name, ok = strings.Cut(strings.TrimSpace(repo), "/")
	if !ok || owner == "" || name == "" || strings.Contains(name, "/") {
		return "", "", false
	}
	return owner, name, true
}

// escapePath escapes each segment of a slash-separated name, such as a branch
// or file path, keeping the slashes GitHub's endpoints accept as part of it.
func escapePath(p string) string {
	segments := strings.Split(p, "/")
	for i, s := range segments {
		segments[i] = url.PathEscape(s)
	}
	return strings.Join(segments, "/")
}

// isRateLimited reports a primary rate limit response, per
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
func isRateLimited(res response) bool {
	return (res.Status == http.StatusForbidden || res.Status == http.StatusTooManyRequests) &&
		res.Header.Get("X-RateLimit-Remaining") == "0"
}

// repoInfo is the part of GET /repos/{owner}/{repo} the callers use.
type repoInfo struct {
	FullName      string `json:"full_name"`
	DefaultBranch string `json:"default_branch"`
}

// getRepo looks up owner/name, returning a message fit to show when it fails.
func (c *Client) getRepo(ctx context.Context, owner, name, token string) (repoInfo, string) {
	var repo repoInfo
	res, err := c.do(ctx, http.MethodGet, repoPath(owner, name), token, nil, &repo)
	if err != nil {
		return repo, "Couldn't reach GitHub."
	}
	switch {
	case res.Status == http.StatusUnauthorized:
		return repo, "GitHub rejected the token. It may be wrong, expired or revoked."
	case isRateLimited(res):
		return repo, rateLimited
	case res.Status == http.StatusForbidden:
		return repo, "The token isn't allowed to access this repository."
	case res.Status == http.StatusNotFound:
		return repo, fmt.Sprintf("Repository %s/%s wasn't found, or the token can't see it.", owner, name)
	case res.Status != http.StatusOK:
		return repo, fmt.Sprintf("GitHub responded %d when looking up the repository.", res.Status)
	}
	return repo, ""
}

const rateLimited = "GitHub's rate limit was hit. Try again in a few minutes."
