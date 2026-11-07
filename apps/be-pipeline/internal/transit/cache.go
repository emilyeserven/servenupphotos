package transit

import (
	"sync"
	"time"
)

// cacheFor is how long an answer is kept: the lines OpenStreetMap maps change
// rarely, and a trip line's hops are often looked up again.
const cacheFor = 24 * time.Hour

// cacheSize is the most answers kept; a track can be a few hundred kilobytes.
const cacheSize = 200

// Cache keeps Overpass answers by query for a while, so looking up the same
// hop again doesn't ask a server. A nil Cache keeps nothing.
type Cache struct {
	ttl  time.Duration
	size int

	mu      sync.Mutex
	answers map[string]cached
}

// cached is one kept answer and when it was got.
type cached struct {
	elements []element
	at       time.Time
}

// NewCache keeps up to size answers, each for ttl.
func NewCache(ttl time.Duration, size int) *Cache {
	return &Cache{ttl: ttl, size: size, answers: map[string]cached{}}
}

// get is the answer kept for ql, if it's still fresh.
func (c *Cache) get(ql string) ([]element, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	a, ok := c.answers[ql]
	if !ok || time.Since(a.at) > c.ttl {
		return nil, false
	}
	return a.elements, true
}

// put keeps elements as ql's answer, first making room by dropping old
// answers.
func (c *Cache) put(ql string, elements []element) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.answers) >= c.size {
		c.makeRoom()
	}
	c.answers[ql] = cached{elements: elements, at: time.Now()}
}

// makeRoom drops the expired answers, or the oldest one when none have.
func (c *Cache) makeRoom() {
	var oldest string
	var oldestAt time.Time
	for ql, a := range c.answers {
		if time.Since(a.at) > c.ttl {
			delete(c.answers, ql)
		} else if oldest == "" || a.at.Before(oldestAt) {
			oldest, oldestAt = ql, a.at
		}
	}
	if len(c.answers) >= c.size {
		delete(c.answers, oldest)
	}
}
