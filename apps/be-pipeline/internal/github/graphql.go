package github

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

// graphqlURL is GitHub's GraphQL endpoint for BaseURL: /graphql next to
// api.github.com, and /api/graphql for GitHub Enterprise's /api/v3.
func (c *Client) graphqlURL() string {
	return strings.TrimSuffix(strings.TrimRight(c.BaseURL, "/"), "/v3") + "/graphql"
}

// graphqlError is one entry of a GraphQL response's errors.
type graphqlError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// graphql runs query with vars and decodes its data into out. One GraphQL
// query reads what would take a REST call per file, and costs one point of
// GitHub's GraphQL rate limit. doing names what it reads, for errors; a
// missing repository is reported as t's.
// See https://docs.github.com/en/graphql/guides/forming-calls-with-graphql
func (c *Client) graphql(ctx context.Context, t target, query string, vars map[string]any, out any, doing string) *PublishError {
	var body struct {
		Data   json.RawMessage `json:"data"`
		Errors []graphqlError  `json:"errors"`
	}
	in := map[string]any{"query": query, "variables": vars}
	res, err := c.doURL(ctx, http.MethodPost, c.graphqlURL(), t.token, in, &body)
	if perr := readCheck(res, err, doing); perr != nil {
		return perr
	}
	if len(body.Errors) > 0 {
		return graphqlErr(res, body.Errors[0], t, doing)
	}
	if err := json.Unmarshal(body.Data, out); err != nil {
		return publishErr(http.StatusBadGateway, "GitHub's answer couldn't be read when %s.", doing)
	}
	return nil
}

// graphqlErr turns the first error of a GraphQL answer into a PublishError.
func graphqlErr(res response, e graphqlError, t target, doing string) *PublishError {
	switch e.Type {
	case "RATE_LIMITED":
		return rateLimitErr(res.Header)
	case "NOT_FOUND":
		return publishErr(http.StatusBadGateway, "Repository %s/%s wasn't found, or the token can't see it.", t.owner, t.name)
	case "FORBIDDEN":
		return publishErr(http.StatusBadGateway, readAccess)
	}
	return publishErr(http.StatusBadGateway, "GitHub couldn't answer when %s: %s", doing, e.Message)
}
