package memo

import (
	"testing"
	"time"
)

func TestCacheMakesRoom(t *testing.T) {
	c := New[int](time.Hour, 2)
	c.Put("a", 1)
	c.Put("b", 2)
	c.Put("c", 3)
	if _, ok := c.Get("a"); ok {
		t.Error("the oldest answer was kept")
	}
	if v, ok := c.Get("c"); !ok || v != 3 {
		t.Errorf("c = %d, %v", v, ok)
	}
}

func TestCacheExpires(t *testing.T) {
	c := New[int](-time.Second, 2)
	c.Put("a", 1)
	if _, ok := c.Get("a"); ok {
		t.Error("an expired answer was given")
	}
}

func TestNilCache(t *testing.T) {
	var c *Cache[int]
	c.Put("a", 1)
	if _, ok := c.Get("a"); ok {
		t.Error("a nil cache kept an answer")
	}
}
