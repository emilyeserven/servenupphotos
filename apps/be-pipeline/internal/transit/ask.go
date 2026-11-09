package transit

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"time"
)

// serverTimeout is the [timeout:] every query sends: how long the server may
// run it. A lower value is also less likely to be turned away when the server
// is loaded (https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#timeout:).
const serverTimeout = "[out:json][timeout:20];"

// tryTimeout is how long one server gets to answer before the next is tried:
// the server's own 20s plus time for the answer to arrive.
const tryTimeout = 25 * time.Second

// rounds is how many times each server is tried.
const rounds = 2

// errUnreadable is a server's answer that isn't Overpass JSON, as a busy
// server sometimes sends.
var errUnreadable = errors.New("the Overpass server's answer couldn't be read")

// ErrSlow is a server that didn't answer within tryTimeout, or before the
// look-up ran out of time.
var ErrSlow = errors.New("the Overpass server didn't answer in time")

// slowOr is ErrSlow when ctx ran out of time, or else err.
func slowOr(ctx context.Context, err error) error {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return ErrSlow
	}
	return err
}

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
// wrong isn't tried again. Running out of time after a try counts as every
// server being busy, since it's their load and not the query.
func (c *Client) ask(ctx context.Context, ql string) ([]element, error) {
	busy := &BusyError{Servers: len(c.BaseURLs)}
	for i := range rounds * len(c.BaseURLs) {
		if err := c.pause(ctx, i); err != nil {
			return nil, outOfTime(ctx, busy, err)
		}
		base := c.BaseURLs[i%len(c.BaseURLs)]
		elements, err := c.timedAsk(ctx, base, ql, i+1)
		if err == nil {
			return elements, nil
		}
		busy.Tries, busy.Server, busy.Last = i+1, host(base), err
		if !worthRetrying(ctx, err) {
			return nil, outOfTime(ctx, busy, err)
		}
	}
	return nil, busy
}

// timedAsk is askOnce, logging which server try was asked, how long it took
// and what it answered, so a slow look-up can be followed in the terminal.
func (c *Client) timedAsk(ctx context.Context, base, ql string, try int) ([]element, error) {
	start := time.Now()
	elements, err := c.askOnce(ctx, base, ql)
	took := time.Since(start).Round(time.Millisecond)
	if err != nil {
		slog.Warn("overpass try failed", "server", host(base), "try", try, "took", took, "err", err)
		return nil, err
	}
	slog.Info("overpass answered", "server", host(base), "try", try, "took", took, "elements", len(elements))
	return elements, nil
}

// outOfTime is busy when ctx ran out of time after at least one try, or else
// err, such as a query turned down as wrong or a caller that went away.
func outOfTime(ctx context.Context, busy *BusyError, err error) error {
	if busy.Tries > 0 && errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return busy
	}
	return err
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
