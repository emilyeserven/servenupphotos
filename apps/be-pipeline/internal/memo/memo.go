// Package memo keeps answers from public servers for a while, by question,
// so asking the same thing again, such as looking up the same hop's transit
// lines or the same area, doesn't ask the server again.
package memo

import (
	"sync"
	"time"
)

// Cache keeps up to Size answers, each for TTL. A nil Cache keeps nothing.
type Cache[T any] struct {
	ttl  time.Duration
	size int

	mu      sync.Mutex
	answers map[string]kept[T]
}

// kept is one answer and when it was got.
type kept[T any] struct {
	value T
	at    time.Time
}

// New keeps up to size answers, each for ttl.
func New[T any](ttl time.Duration, size int) *Cache[T] {
	return &Cache[T]{ttl: ttl, size: size, answers: map[string]kept[T]{}}
}

// Get is the answer kept for key, if it's still fresh.
func (c *Cache[T]) Get(key string) (T, bool) {
	var none T
	if c == nil {
		return none, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	a, ok := c.answers[key]
	if !ok || time.Since(a.at) > c.ttl {
		return none, false
	}
	return a.value, true
}

// Put keeps value as key's answer, first making room by dropping old answers.
func (c *Cache[T]) Put(key string, value T) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.answers) >= c.size {
		c.makeRoom()
	}
	c.answers[key] = kept[T]{value: value, at: time.Now()}
}

// makeRoom drops the expired answers, or the oldest one when none have.
func (c *Cache[T]) makeRoom() {
	var oldest string
	var oldestAt time.Time
	for key, a := range c.answers {
		if time.Since(a.at) > c.ttl {
			delete(c.answers, key)
		} else if oldest == "" || a.at.Before(oldestAt) {
			oldest, oldestAt = key, a.at
		}
	}
	if len(c.answers) >= c.size {
		delete(c.answers, oldest)
	}
}
