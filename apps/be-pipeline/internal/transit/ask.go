package transit

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"time"
)

// tryTimeout is how long one server gets to answer before the next is tried.
// The queries themselves ask the server to give up after 25s.
const tryTimeout = 20 * time.Second

// rounds is how many times each server is tried.
const rounds = 2

// errUnreadable is a server's answer that isn't Overpass JSON, as a busy
// server sometimes sends.
var errUnreadable = errors.New("the Overpass server's answer couldn't be read")

// StatusError is a server's answer other than 200 OK, such as 429 Too Many
// Requests when asked too often or 502 or 504 when it's overloaded.
type StatusError struct {
	// Code is the HTTP status code, such as 502.
	Code int
	// Status is the status line, such as "502 Bad Gateway".
	Status string
}

// Error says what the server answered.
func (e *StatusError) Error() string {
	return "the Overpass server answered " + e.Status
}

// BusyError is returned when every server was tried and none answered.
type BusyError struct {
	// Tries is how many requests were made.
	Tries int
	// Servers is how many servers were asked.
	Servers int
	// Last is the last server's failure.
	Last error
	// Server is the host of the last server tried, such as "overpass-api.de".
	Server string
}

// Error says how many tries failed and what the last server said.
func (e *BusyError) Error() string {
	return "no Overpass server answered; " + e.Server + " said: " + e.Last.Error()
}

// Unwrap is the last server's failure.
func (e *BusyError) Unwrap() error { return e.Last }

// ask runs ql on each server in turn, rounds times over, waiting a little
// longer before each try, until one answers. A query the server turns down as
// wrong isn't tried again.
func (c *Client) ask(ctx context.Context, ql string) ([]element, error) {
	var err error
	tries := rounds * len(c.BaseURLs)
	for i := range tries {
		base := c.BaseURLs[i%len(c.BaseURLs)]
		if err = c.pause(ctx, i); err != nil {
			return nil, err
		}
		var elements []element
		if elements, err = c.askOnce(ctx, base, ql); err == nil {
			return elements, nil
		}
		if !worthRetrying(ctx, err) {
			return nil, err
		}
		if i == tries-1 {
			return nil, &BusyError{Tries: tries, Servers: len(c.BaseURLs), Last: err, Server: host(base)}
		}
	}
	return nil, err
}

// pause waits before try i (counting from 0): not at all before the first,
// then by Waits, until ctx ends.
func (c *Client) pause(ctx context.Context, i int) error {
	if i == 0 || len(c.Waits) == 0 {
		return ctx.Err()
	}
	select {
	case <-time.After(c.Waits[min(i-1, len(c.Waits)-1)]):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// worthRetrying reports whether another server might answer: false once the
// caller has given up, or for a status that says the query itself is wrong.
func worthRetrying(ctx context.Context, err error) bool {
	if ctx.Err() != nil {
		return false
	}
	var status *StatusError
	if errors.As(err, &status) {
		return status.Code == http.StatusTooManyRequests || status.Code >= 500
	}
	return true
}

// host is base's host name, such as "overpass-api.de", or base itself.
func host(base string) string {
	if u, err := url.Parse(base); err == nil && u.Host != "" {
		return u.Host
	}
	return base
}
