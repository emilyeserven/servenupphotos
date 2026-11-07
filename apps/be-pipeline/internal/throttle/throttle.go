// Package throttle spaces out requests to a public server that asks for no
// more than one request in a while, such as the OpenStreetMap routing and
// Overpass servers.
package throttle

import (
	"context"
	"sync"
	"time"
)

// Gate lets one request through per Gap, however many callers wait at once.
// The zero Gate lets every request through.
type Gate struct {
	// Gap is the least time between two requests.
	Gap time.Duration

	mu   sync.Mutex
	last time.Time
}

// Wait holds a request until Gap has passed since the last one let through,
// or until ctx ends.
func (g *Gate) Wait(ctx context.Context) error {
	g.mu.Lock()
	next := g.last.Add(g.Gap)
	now := time.Now()
	if next.Before(now) {
		next = now
	}
	g.last = next
	g.mu.Unlock()
	select {
	case <-time.After(time.Until(next)):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
