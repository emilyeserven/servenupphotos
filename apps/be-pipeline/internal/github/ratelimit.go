package github

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// isRateLimited reports a primary or secondary rate limit response, per
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api:
// a 429, or a 403 that says no requests are left, asks to wait, or names a
// rate limit.
func isRateLimited(res response) bool {
	switch res.Status {
	case http.StatusTooManyRequests:
		return true
	case http.StatusForbidden:
		return res.Header.Get("X-RateLimit-Remaining") == "0" || res.Header.Get("Retry-After") != "" ||
			strings.Contains(strings.ToLower(res.Body), "rate limit")
	}
	return false
}

// rateLimitMessage says GitHub's rate limit was hit and when it can be tried
// again: after Retry-After seconds, at X-RateLimit-Reset, or else in a minute,
// as GitHub asks.
func rateLimitMessage(header http.Header, now time.Time) string {
	wait := time.Minute
	if secs, err := strconv.Atoi(header.Get("Retry-After")); err == nil {
		wait = time.Duration(secs) * time.Second
	} else if reset, err := strconv.ParseInt(header.Get("X-RateLimit-Reset"), 10, 64); err == nil {
		wait = time.Unix(reset, 0).Sub(now)
	}
	at := now.Add(wait).UTC().Format("15:04 UTC")
	return fmt.Sprintf("GitHub's rate limit was hit, so nothing was read or saved. Try again %s (%s); your changes are kept until then.",
		waitText(wait), at)
}

// waitText is how long wait is, as "in 23 minutes".
func waitText(wait time.Duration) string {
	switch {
	case wait <= time.Minute:
		return "in a minute"
	case wait < time.Hour:
		return fmt.Sprintf("in %d minutes", int(wait.Round(time.Minute)/time.Minute))
	default:
		return "in about an hour"
	}
}

// rateLimitErr is the PublishError for a rate-limited response.
func rateLimitErr(header http.Header) *PublishError {
	return publishErr(http.StatusTooManyRequests, "%s", rateLimitMessage(header, time.Now()))
}
